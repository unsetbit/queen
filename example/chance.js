var startTime = (new Date()).getTime();
var numberToFind = 42;
var maxNumber = 100;

var workforce = queen({
	scripts: ['http://localhost/example/chance.js'],
	populate: "continuous",
	killOnStop: false,
	handler: function(worker){
		worker(maxNumber);
	}
});

workforce.on('message', function(number, worker){
	console.log(number + " (" + worker.provider.attributes.name + ")");

	if(number === 42){
		workforce.kill();	
		var endTime = (new Date()).getTime();
		var secondsToComplete = (endTime - startTime) / 1000;
		console.log('Done! That took ' + secondsToComplete + " seconds. The winner was " + worker.provider.attributes.name);
		process.exit(0);
	}
});