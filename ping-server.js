module.exports = function(queen){
	var config = {
		run: ['http://queenjs.com/ping-client.js'],
		
		// This tells queen to run this script on any
		// browsers which are connected now and in the future
		populate: "continuous", 
		
		// By default, queen will kill a workforce (i.e. this job)
		// if there are no browsers connected, this tells queen
		// that it's ok to idle and wait for browsers to connect.
		killOnStop: false,
		
		// This function gets called right before a browser starts 
		// running the client script.
		handler: function(worker){ 
			// Worker can be thought of as the browser.
			worker.on('message', function(num){
				console.log(worker.provider + " is at " + num);
				
				// If the browser has pinged us 10 times, kill it.
				if(num === 10){
					worker.kill();
				} else {
					// Echo the number back to the worker
					worker(num);
				}
			});
		
			// Tell the worker to start at 0
			worker(0);
		}
	}

	// queen is a global variable of the running queen instance
	queen(config);
};