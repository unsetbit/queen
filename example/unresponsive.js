/* 	
Unresponsive Example

This example shows how queen can detect and kill the workers of unresponsive 
hosts (browsers) proactively.

We ask any browser which connects to execute an intense loop, which should
block the process for more than 5 seconds (the default hearbeat interval).
Once Queen notices that the browser hasn't sent a heart beat in over 5 seconds,
it will deem it "unresponsive" and kill off any of it's workers.

If the browser was started by a populator, queen will immediately spawn a
similar one and close the unresponsive one.

*/

function onServerReady(){
	queen({
		scripts: ['http://localhost:9236'],
		populate: "continuous",
		killOnStop: false,
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
var script = "for(var i = 0; i < 2000000000; i++) 1 + 1;";
script += "socket.kill();";

var server = require('http').createServer(function(request, response){
	response.writeHead(200, {'Content-Type': 'application/javascript'});
	response.end(script);
}).listen('9236', onServerReady);