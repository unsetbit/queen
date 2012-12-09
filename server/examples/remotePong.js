var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteQueen = require("../lib/remote/queen.js");

var onReady = function(queen){
	if(queen.workerProviders.length > 0){
		runPongExample(queen);		
	} else {
		console.log('Waiting for a worker provider to connect...');
	}

	queen.on('workerProvider', function(){
		for(var i = 0; i < 1; i++){
			runPongExample(queen);		
		}
	});
};

var runPongExample = function(queen){
	var workforce = queen({
		scriptPath: 'http://192.168.0.105/ping.js',
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

createRemoteQueen(onReady);