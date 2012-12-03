var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteMinionMaster = require("../lib/remote/minionMaster.js");

var onReady = function(minionMaster){
	if(minionMaster.workerProviders.length > 0){
		runPongExample(minionMaster);		
	} else {
		console.log('Waiting for a worker provider to connect...');
	}

	minionMaster.on('workerProvider', function(){
		for(var i = 0; i < 100; i++){
			runPongExample(minionMaster);		
		}
	});
};

var runPongExample = function(minionMaster){
	var workforce = minionMaster({
		scriptPath: 'https://raw.github.com/ozanturgut/minion-master/master/client/static/ping.js',
		timeout: 1000 * 3,
		handler: pingPong,
		done: function(){
			console.log('done!');
		}
	});
};

var pingPong = function(worker){
	worker.on('message', function(message){
		console.log(message);
		worker('pong');
		console.log('pong');
	});
}

createRemoteMinionMaster(onReady);