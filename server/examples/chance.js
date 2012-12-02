var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	socketio = require("socket.io"),
	http = require('http'),
	createMinionMaster = require("../lib/minionMaster.js"),
	createStaticServer = require("../lib/staticServer.js").create;

var port = 80,
	hostname = "localhost",
	browserCapturePath = "/capture",
	httpServer = createStaticServer({port: port, hostname: hostname}),
	socketServer = socketio.listen(httpServer, {log: false}),
	socket = socketServer.of(browserCapturePath),
	minionMaster = createMinionMaster(socket, {logger:logger.info.bind(logger)});

minionMaster.on('workerProvider', function(){
	var startTime = (new Date()).getTime();
	var workforces = [];
	for(var i = 0; i < 100; i++){
		var workforce = minionMaster({
			scripts: ['http://localhost/chance.js'],
			done: function(){
			}
		});

		var numberToFind = 42;
		var maxNumber = 10000;

		workforce.on('message', function(number, worker){
			if(number === 42){
				workforces.forEach(function(workforce){
					workforce.kill();	
				});
				var endTime = (new Date()).getTime();
				var secondsToComplete = (endTime - startTime) / 1000;
				console.log('Done! That took ' + secondsToComplete + " seconds. The winner was " + worker.provider.attributes.name);
			}
		});
		workforces.push(workforce);
	}
	workforces.forEach(function(workforce){
		workforce(maxNumber);
	});
});

