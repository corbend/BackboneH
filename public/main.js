var LinkedStore = Backbone.Collection.extend({
	_parent: null,
	_childs: null,
	urlRoot: '',
	jsonNamespace: '',
	parentIdName: '',
	root: '',
	leafFetchMode: false,
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
			c.trigger('sync');
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
	initialize: function(options) {

		this._childs = [];
		//настройка если мы нехотим чтобы дочерние элементы запрашивали данные с сервера
		//а брали их с родительской коллекции
		//при добавлении вытаскимаем вложенные записи и добавляем
		//в каждый дочерний store

		this.on('add', function(model) {
			var childs = this.getChildren(),
				nestedJsons;

			childs.forEach(function(c) {
				nestedJsons = model.get(c.getNamespace());

				if (!_.isEmpty(nestedJsons)) {
					c.add(nestedJsons);
				}
			}, this);
		}, this);

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
	getChildren: function(parentModel, jsonNamespace) {
		return this._childs;
	},
	getParent: function() {
		return this._parent;
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

		return this;
	}
});

var ListView = Backbone.View.extend({

	el: "#list",

	className: 'list-view',
	initialize: function() {

		this.collection.on("reset", function() {
			this.$el.children().remove();
		}, this);

		this.collection.on('sync', function(options) {
			if (!this.collection._resync) {
				this.render();
			}
		}, this);

		this.collection.on('remove', function() {

		});
	},
	_styleForNested: function(nested) {
		nested.css('marginLeft', '80px');	
	},
	_onParentChange: function(model, renderToParent) {

		var childModel, parentView;
		var store = model.collection;
		var renderTo = renderToParent || this.$el;

		parentView = $((new ItemView({
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
					// for (var c=0; c < childViews.length; c++) {
					// 	childViews[c].remove();
					// }
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

		this.setEventsByChildren(this.collection);

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
			m3prop: 'prop4'
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
	var c4 = new LinkedStore({model: M3, url: '/values', urlRoot: 'values', leafFetchMode: true});
	c3.url = "/tags";

	c1.addChild(c2);
	c2.addChild(c3);
	c3.addChild(c4);

	var view = new ListView({collection: c1});
	view.render();

	c1.fetch(
		{success: function() {
			c2.at(0).destroy();
		}}
	);
	// debugger;
	// c1.reset([]);

});	