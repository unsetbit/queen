var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createQueen = require("../../");

// init http server
var path = require('path'),
	express = require('express'),
	expressServer = express(),
	webRoot = path.resolve(path.dirname(module.filename), '../../client/static'),
	httpServer = require('http').createServer()
								.listen(80, "localhost")
								.on('request', expressServer);

expressServer.use('', express.static(webRoot));

// init socket.io
var socketServer = require("socket.io").listen(httpServer, {log: false}),
	socket = socketServer.of("/capture");

// the example
var	queen = createQueen(socket, {logger:logger.info.bind(logger)});

queen.on('workerProvider', function(){
	var startTime = (new Date()).getTime();
	var numberToFind = 42;
	var maxNumber = 10000;

	var workforce = queen({
		scripts: ['http://localhost/example/chance.js'],
		handler: function(worker){
			worker(maxNumber);
		}
	});

	workforce.on('message', function(number, worker){
		console.log(number);
		if(number === 42){
			workforce.kill();	
			var endTime = (new Date()).getTime();
			var secondsToComplete = (endTime - startTime) / 1000;
			console.log('Done! That took ' + secondsToComplete + " seconds. The winner was " + worker.provider.attributes.name);
		}
	});
});
