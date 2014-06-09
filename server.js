var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var PORT = process.env.NODE_PORT || 8080;
var app = express();
var server = http.createServer(app).listen(PORT, 'localhost', function() {
	console.log("Server listening on port="+PORT);
});

app.use(bodyParser());
app.use(express.static(path.join(__dirname, "public")));

var testModels = [
	{id: 1, name: 'appType1', description: 'DescAppType1',
		metrics: [
			{id: 1, name: 'appType1_metric1', description: 'Описание метрики1',
	 			tags: [
	 				{id: 1, name: 'Tag1', description: 'Tag1',
	 					values: [{id: 1, name: 'Val1', description: 'Val1 Desc'}]},
	 				{id: 2, name: 'Tag2', description: 'Tag2'},
	 				{id: 3, name: 'Tag3', description: 'Tag3'}
	 			]},
			{id: 2, name: 'appType1_metric2', description: 'Описание метрики2'},
			{id: 3, name: 'appType1_metric3', description: 'Описание метрики3'}
		]
	},
	{id: 2, name: 'appType2', description: 'DescAppType2',
		metrics: [
			{id: 4, name: 'appType2_metric4', description: 'Описание метрики1',
	 			tags: [
	 				{id: 4, name: 'Tag4', description: 'Tag4'},
	 				{id: 5, name: 'Tag5', description: 'Tag5'},
	 				{id: 6, name: 'Tag6', description: 'Tag6'}]
	 		},
			{id: 5, name: 'appType2_metric5', description: 'Описание метрики2'},
			{id: 6, name: 'appType2_metric6', description: 'Описание метрики3'}
		]
	},
	{id: 3, name: 'appType3', description: 'DescAppType3',
		metrics: [
			{id: 7, name: 'appType3_metric7', description: 'Описание метрики1',
	 			tags: [
	 				{id: 7, name: 'Tag7', description: 'Tag7'},
	 				{id: 8, name: 'Tag8', description: 'Tag8'},
	 				{id: 9, name: 'Tag9', description: 'Tag9'}
	 			]
	 		},
			{id: 8, name: 'appType3_metric8', description: 'Описание метрики2'},
			{id: 9, name: 'appType3_metric9', description: 'Описание метрики3'}
		]
	},

]

app.get("/", function(req, res) {
	res.sendfile("backbone.html");
})

app.get("/apps", function(req, res) {

	res.writeHeader('contentType', 'application/json');
	res.end(JSON.stringify(testModels));
});