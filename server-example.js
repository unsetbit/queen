/*
Chance Example

This example shows an example of a distributed problem solving in queen.
Any browser which connects will begin guessing numbers under "maxNumber",
once any of the browsers find the "numberToFind", all workers will be killed,
and the process will exit.

The process will continue to run until one browser guesses the right number,
if no browsers are connected, it'll idle and wait.

*/
module.exports = function(queen){
	var numberToFind = 42,
		maxNumber = 300,
		workforceConfig = {},
		workforce;

	// Run this script on the client-side (i.e. browser).
	workforceConfig.run = ['http://queenjs.com/client-example.js'];

	// If a browser connects after we started, have them join the workforce
	workforceConfig.populate = "continuous";

	// Don't kill the workforce if it's idling with no browsers connected
	workforceConfig.killOnStop = false;

	// When a new worker (i.e. browser) connects, trigger this handler function
	workforceConfig.handler = function(worker){
		// Tell the worker the maximum number to guess
		worker(maxNumber);
		
		// Whenever a worker has a message, execute a handler function
		worker.on("message", function(guessedNumber){
			console.log(guessedNumber + " \t guessed by " + worker.provider.attributes.name);

			if(guessedNumber === numberToFind){
				workforce.kill();	
				console.log("Done! The winner was " + worker.provider.attributes.name);
			
				// We're done
				queen.kill();
			}
		});
	};

	// Create the workforce
	workforce = queen(workforceConfig);	
};
