var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createMinionMaster = require("../../").minionMaster.create;

var minionMaster = createMinionMaster({	logger:logger });
minionMaster.on("workerProviderConnected", function(){
	var workforce = minionMaster.createWorkforce(['http://localhost/ping.js'], {
		timeout:5000,
		autostart:true,
		onWorkStart: function(worker){
			worker.on('ping', function(){
				console.log('ping');
				worker.emit('pong');
				console.log('pong');
			});

			worker.on('timeout', function(){
				console.log('timeout');
			});
		}
	});
});