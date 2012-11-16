var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createMinionMaster = require("../../").minionMaster.create;

var minionMaster = createMinionMaster({	logger:logger });
minionMaster.on("workerProviderConnected", function(){
	var workforce = minionMaster.createWorkforce(['http://localhost/ping.js'], {timeout:5000});

	workforce.on("workerStarted", function(data){
		var provider = data.provider,
			socket = data.socket;

		socket.on('ping', function(){
			console.log('ping');
			socket.emit('pong');
			console.log('pong');
		});

		socket.on('timeout', function(){
			console.log('timeout');
		});
	});
	workforce.start();
});