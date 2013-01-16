/*
Chance Example

This example shows an example of a distributed problem solving in queen.
Any browser which connects will begin guessing numbers under "maxNumber",
once any of the browsers find the "numberToFind", all workers will be killed,
and the process will exit.

The process will continue to run until one browser guesses the right number,
if no browsers are connected, it'll idle and wait.

*/

function onHttpServerReady(){
	var numberToFind = 42,
		maxNumber = 100;

	var workforce = queen({
		run: 'http://192.168.0.100:9235',
		populate: "continuous",
		killOnStop: false,
		handler: function(worker){
			worker(maxNumber);
			
			worker.on("message", function(guess){
				console.log(number + " (" + worker.provider.attributes.name + ")");
			});
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
};

// This spawns a basic http server which just serves the client-side script.
// This is done just to keep everything in the example inside one file,
// in real life, you should serve your scripts out of a more respectable server.
var theClientScript = "" +
"	queenSocket.onMessage = function(maxNumber){				"+
"		setInterval(function(){									"+
"			var guess = Math.floor(Math.random() * maxNumber);	"+
"			queenSocket(guess);									"+
"		}, 100);												"+
"	};															";


var server = require('http').createServer(function(request, response){
	response.end(theClientScript);
}).listen('9302', onHttpServerReady);