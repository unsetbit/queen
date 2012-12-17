var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createQueen = require("../");

// the example
var	queen = createQueen({logger:logger.info.bind(logger)});

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
