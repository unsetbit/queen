var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteMinionMaster = require("../lib/remoteClient/minionMaster.js").create;

var minionMaster = createRemoteMinionMaster({logger:logger});

for(i = 2; i > 0; i--){
	workforce = minionMaster.getWorkforce();
	workforce.on('workerAdded', function(worker){
							worker.on('ping', function(){
							console.log('ping');
							worker.emit('pong');
							console.log('pong');
						})
					});
	workforce.start({scripts: ['http://localhost/ping.js']}, 1000 * 10, ['ping', 'pong']);
}
