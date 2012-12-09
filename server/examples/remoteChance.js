var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteMinionMaster = require("../lib/remote/minionMaster.js");

var onReady = function(minionMaster){
	if(minionMaster.workerProviders.length > 0){
		runChanceExample(minionMaster);
	} else {
		console.log('Waiting for a worker provider to connect...');
	}

	minionMaster.on('workerProvider', function(){
		runChanceExample(minionMaster);		
	});
};

var runChanceExample = function(minionMaster){
	console.log('Starting the random number finder...');

	var startTime = (new Date()).getTime();
	var workforces = [];
	for(var i = 0; i < 1; i++){
		var workforce = minionMaster({
			scriptPath: 'http://192.168.0.105/chance.js'
		});

		var numberToFind = 42;
		var maxNumber = 100;

		workforce.on('message', function(number, worker){
			console.log(number + " (" + worker.provider.attributes.name + ")");
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
}

createRemoteMinionMaster(onReady);
