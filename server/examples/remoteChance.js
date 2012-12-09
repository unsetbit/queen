var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteQueen = require("../lib/remote/queen.js");

var onReady = function(queen){
	if(queen.workerProviders.length > 0){
		runChanceExample(queen);
	} else {
		console.log('Waiting for a worker provider to connect...');
	}

	queen.on('workerProvider', function(){
		runChanceExample(queen);		
	});
};

var runChanceExample = function(queen){
	console.log('Starting the random number finder...');

	var startTime = (new Date()).getTime();
	var workforces = [];
	for(var i = 0; i < 1; i++){
		var workforce = queen({
			scriptPath: 'http://localhost/chance.js',
			filter: function(attributes){
				return attributes.name.indexOf("IE") >= 0;
			},
			done: function(){
				console.log('done!');
			}
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

createRemoteQueen(onReady);
