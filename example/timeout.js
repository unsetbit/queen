/* 	
Timeout Example

This example shows how queen can kill workers if they don't complete their
work in a given amount of time.

We send an empty script to any browser which connects to queen. Then we tell
queen to 'timeout' any worker which isn't killed (either by itself or by us)
in 1 second. Since we won't kill it manually on our end, and the browser won't
kill it (because we just send a blank script), queen will kill it automatically
after one second.

*/
module.exports = function(queen){
	function onServerReady(){
		queen({
			run: ['http://localhost:9236'],
			populate: "continuous",
			killOnStop: false,
			timeout: 1000,
			handler: function(worker){
				console.log(worker.provider + ": Worker spawned!");
				worker.on('dead', function(reason){
					console.log(worker.provider + ': Worker dead! Reason: ' + reason);
				});
			}
		});
	};

	// This spawns a basic http server which just serves the client-side script.
	// This is done just to keep everything in the example inside one file,
	// in real life, you should serve your scripts out of a more respectable server.
	var script = "";

	var server = require('http').createServer(function(request, response){
		response.writeHead(200, {'Content-Type': 'application/javascript'});
		response.end(script);
	}).listen('9236', onServerReady);
};