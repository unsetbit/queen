/*
Ping Example

From this directory, run: ../bin/queen ping.js

This example illustrates basic message passing in queen.

Browsers which connect to the server (or are already connected) will spawn
a worker which will wait for a "ping" message from the caller. Once they recieve
a "ping" message, they will respond with a "pong" message. Once the caller recieves
the "pong" response, it will kill the worker.

*/
module.exports = function(queen){
	function onServerReady(){
		queen({
			run: ['http://localhost:9234/'],
			populate: "continuous",
			killOnStop: false,
			handler: function(worker){
				worker.on('message', function(num){
					console.log(worker.provider + " is at " + num);
					if(num === 10){
						worker.kill();
					} else {
						// Echo the number back to the worker
						worker(num);
					}
				});

				// Initialize the worker at 0
				worker(0);
			}
		});
	};

	// This spawns a basic http server which just serves the client-side script.
	// This is done just to keep everything in the example inside one file,
	// in real life, you should serve your scripts out of a more respectable server.
	var script = "	queenSocket.onMessage = function(num){";
	script += "			setTimeout(function(){";
	script += "				queenSocket(num + 1);";
	script += "			}, 1000);";
	script += "		};";

	var server = require('http').createServer(function(request, response){
		response.writeHead(200, {'Content-Type': 'application/javascript'});
		response.end(script);
	}).listen('9234', onServerReady);
};