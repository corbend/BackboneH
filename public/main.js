var LinkedStore = Backbone.Collection.extend({
	_parent: null,
	_childs: null,
	urlRoot: '',
	jsonNamespace: '',
	parentIdName: '',
	root: '',
	leafFetchMode: false,
	syncAfterReset: true,
	populateOnParse: true,
	getNamespace: function() {
		return this.jsonNamespace || this.model.urlRoot || this.urlRoot;
	},
	proccessInner: function(childStore, parentJsonModel) {
		var arr = [];

		childJsonModels = parentJsonModel[childStore.getNamespace()];
				
		if (!_.isEmpty(childJsonModels)) {	
			childJsonModels.forEach(function(nestJsonModel) {

				if (this.parentIdName) {
					nestJsonModel[this.parentIdName] = parentJsonModel['id'];
				}

				arr.push(nestJsonModel);
			}, this);
		}

		return arr;
	},
	_populate: function(response) {
		var nestedModels, namespace;
		nestedModels = [];

		childs = this.getChildren();

		childs.forEach(function(c) {
					
			if (_.isArray(response)) {
				response.forEach(function(jsonModel) {
					nestedModels = nestedModels.concat(this.proccessInner(c, jsonModel));
				}, this);
			} else if (_.isObject(response)) {
				nestedModels = nestedModels.concat(this.proccessInner(c, response));
			}
			//добавляем дочерние модели
			c.reset();
			c.add(nestedModels);
			console.log("sync");
			c.trigger('sync', this);
		}, this);
	},
	parse: function(response, options) {
		var ns, childs;

		if (this.populateOnParse) {
			this._populate(response);
		}

		return response;
	},
	_getByNamespace: function(ns) {
		var records = []; 
		this.each(function(model) {
			records = records.concat(model.get(ns));
		});
		return records;
	},
	_fetchWrap: function() {
		this.fetch = _.wrap(this.fetch, function(func) {
			var parent = this.getParent(), fm;
			if (parent) {
				this.reset();
				records = parent._getByNamespace(this.getNamespace());
				//по парсу срабатывает наполнение дочерних сторов
				this.add(records);
				this.trigger('sync');
			} else {
				func.apply(this, arguments);
			}
		});
		_.bind(this.fetch, this);
	},
	_onItemAdd: function(model) {

		var childs = this.getChildren(),
			nestedJsons;

		childs.forEach(function(c) {
			nestedJsons = model.get(c.getNamespace());
			if (!_.isEmpty(nestedJsons)) {
				c.add(nestedJsons);
				// console.log("ADD TO CHILD=" + c.getNamespace() + ", " + c.models.length);
			}
		}, this);
	},
	initialize: function(options) {

		this._childs = [];
		//настройка если мы нехотим чтобы дочерние элементы запрашивали данные с сервера
		//а брали их с родительской коллекции
		//при добавлении вытаскимаем вложенные записи и добавляем
		//в каждый дочерний store
		console.log("init");
		this.on('add', this._onItemAdd, this);

		this.on('reset', function(collection, options) {

			collection.forEach(function(model) {
				this._onItemAdd(model);
			}, this);

			// if (this.syncAfterReset) {
			// 	this.trigger('sync', this);
			// }
		});

		this.on('destroy', function(model) {
			var deletedModel;
			var childs = this.getChildren(),
				nestedJsons;

			childs.forEach(function(c) {
				nestedJsons = model.get(c.getNamespace());

				if (!_.isEmpty(nestedJsons)) {
					for (var e=0; e < nestedJsons.length; e++) {
						deletedModel = c.get(nestedJsons[e].id);
						c.remove(deletedModel);
					}
				}
			}, this);
		}, this);


		var modelInstance = new this.model();

		this.urlRoot = options.urlRoot;
		var urlRoot = modelInstance.urlRoot || this.urlRoot;
		urlRoot = urlRoot.replace("/", "");
		var parentId = urlRoot.slice(0, modelInstance.length) + "_id";
		this.parentIdName = this.parentIdName || parentId;

	},
	addChild: function(childStore) {
		this._childs.push(childStore);
		childStore._parent = this;
		childStore._fetchWrap();
	},
	remChild: function(childStore) {
		this._childs = _.without(this._childs, childStore);
	},
	getChildren: function(parentModel, jsonNamespace) {
		return this._childs;
	},
	getParent: function() {
		return this._parent;
	},
	filterById: function(relStore, model, refetch) {

		var parentIdName, scope = this;
		var afterSuccess = function(renewModel) {
			//список Json объектов для фильтрации и добавления в дочерний стор
        	var jsonItems = renewModel.get(relStore.getNamespace());
        	if (jsonItems) {
        		relStore.reset();
        		jsonItems.forEach(function(modelJson) {relStore.add(modelJson)}, scope);
	        }
        	//после выполнения операции по извлечению данных убираем дочерний стор
            this.remChild(relStore);
		};

		parentIdName = this.parentIdName;
		this.addChild(relStore);
		if (refetch) {
			model.fetch({
				success: function(renewModel) {
					afterSuccess.call(scope, renewModel);
				}
			});
		} else {
			afterSuccess.call(scope, model);
		}
	}
});

var ItemView = Backbone.View.extend({
	parentModel: null,
	store: null,
	tagName: 'li',
	template: [
		'<span>','<%= name %>','</span>',
		'<span>','<%= description %>','</span>',
		'<span>','<%= parent_id %>','</span>'
	].join("\r\n"),

	initialize: function(options) {

		this.parentModel = this.parentModel || options.parentModel;
		this.store = this.store || options.store;

	},
	render: function() {

		var modelData;

		modelData = _.extend({}, this.model.toJSON(), {
			'parent_id': (this.parentModel && this.parentModel.id) || ''
		});
		this.$el.html(_.template(this.template)(modelData));
		this.$el.data("tab_id", this.options.tab_id);
		return this;
	}
});

var ListView = Backbone.View.extend({

	className: 'list-view',
	tabsCount: 0,
	initialize: function() {

		var onSync = function(options) {
			if (!this.collection._resync) {
				this.render();
			}
		};

		var onReset = function() {
			this.$el.children().remove();
		}

		this.collection.on("reset", onReset, this);
		this.collection.on('sync', onSync, this);

		this.setEventsByChildren(this.collection);

	},
	_styleForNested: function(nested) {
		nested.css('marginLeft', '80px');	
	},
	_onParentChange: function(model, renderToParent) {

		var childModel, parentView;
		var store = model.collection;
		var renderTo = renderToParent || this.$el;

		parentView = $((new ItemView({tab_id: this.tabsCount++,
				model: model})).render().el);

		if (renderToParent) {
			this._styleForNested(parentView);
		}
		renderTo.append(parentView);

		hasChildren = !!store.getChildren().length;

		if (hasChildren) {
			store.getChildren().forEach(function(childStore) {

				var childModels = model.get(childStore.getNamespace());
				var childViews = [];
				if (_.isArray(childModels)) {
					for (var m=0; m < childModels.length; m++) {
						childModel = childStore.get(childModels[m].id);
						childViews.push(this._onParentChange(childModel, parentView));
					}
				}

				model.on('destroy', function() {
					parentView.remove();
				});

			}, this);
		}

		return parentView;
	},
	setEventsByChildren: function(col, parentCollection) {
		col.on('add', function(model, collection) {
			//если родильская коллекция изменилась запускаем рекурсивное распространение
			this._onParentChange(model);
		}, this);
	},
	render: function() {

		this.collection._resync = true;
		try {
			this.collection.trigger('sync');
		} catch(e) {;}
		finally {
			this.collection._resync = false;
		}
		return this;
	}
})

$(function() {

	var M1 = Backbone.Model.extend({
		urlRoot: 'apps',
		defaults: {
			name: '',
			description: '',
			m1prop: 'prop1'
		}
	});

	var M2 = Backbone.Model.extend({
		urlRoot: 'metrics',
		defaults: {
			name: '',
			description: '',
			m2prop: 'prop2'
		}
	});

	var M3 = Backbone.Model.extend({
		urlRoot: 'tags',
		defaults: {
			name: '',
			description: '',
			m3prop: 'prop3'
		}
	});

	var M4 = Backbone.Model.extend({
		urlRoot: 'values',
		defaults: {
			name: '',
			description: '',
			m4prop: 'prop4'
		}
	});

	var M5 = Backbone.Model.extend({
		urlRoot: 'parent',
		defaults: {
			name: '',
			description: '',
			m5prop: 'prop5'
		}
	});

	var m1 = new M1();
	var m2 = new M2();
	var m3 = new M3();
	var m4 = new M4();

	var c1 = new LinkedStore({model: M1, url: '/apps', urlRoot: 'apps', leafFetchMode: false});
	c1.url = "/apps";
	var c2 = new LinkedStore({model: M2, url: '/metrics', urlRoot: 'metrics', leafFetchMode: true});
	c2.url = "/metrics";
	var c3 = new LinkedStore({model: M3, url: '/tags', urlRoot: 'tags', leafFetchMode: true});
	c3.url = "/tags";
	var c4 = new LinkedStore({model: M4, url: '/values', urlRoot: 'values', leafFetchMode: true});
	c4.url = "/values";
	var c5 = new LinkedStore({model: M5, url: '/parent', urlRoot: 'parent', leafFetchMode: true});
	c5.url = "/parent";

	window.c1 = c1;
	window.c2 = c2;
	window.c3 = c3;
	window.c4 = c4;
	window.c5 = c5;

	c1.addChild(c2);
	c2.addChild(c3);
	c3.addChild(c4);

	var ParentList = ListView.extend({
		el: "#parent-list",
		className: 'inline-list',
		events: {
			"click li": 'onClick'
		},
		onClick: function(event) {

			var tabs = this.$("li");
			var idx = 0, selectTabId;
			tabs.each(function(index, item) {
				if ($(item).data("tab_id") == $(event.target).parent().data("tab_id")) {
					selectTabId = idx;
				}
				idx++;
			});
			if (selectTabId != null) {	
				c5.filterById(c1, c5.get(selectTabId + 1), true);
			}
		}
	})
	var ChildList = ListView.extend({
		el: "#list"
	})

	var parentView = new ParentList({collection: c5});
	var childView = new ChildList({collection: c1});

	parentView.render();
	childView.render();

	c1.fetch(
		{success: function() {
			//пример для удаления модели (расскоментировать чтобы увидеть изменения)
			// c2.at(0).destroy();
		}}
	);

	c5.fetch({
		success: function() {
			// c5.filterById(c1, c5.get(1), true);
		}
	});

});	