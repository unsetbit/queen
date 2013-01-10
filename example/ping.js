/*
Ping Example

This example illustrates basic message passing in queen.

Browsers which connect to the server (or are already connected) will spawn
a worker which will wait for a "ping" message from the caller. Once they recieve
a "ping" message, they will respond with a "pong" message. Once the caller recieves
the "pong" response, it will kill the worker.

*/
function onServerReady(){
	queen({
		run: ['http://localhost:9234/'],
		populate: "continuous",
		killOnStop: false,
		handler: function(worker){
			worker.on('message', function(message){
				if(message === 'pong'){
					console.log('Ping-ponged with ' + worker.provider);
					worker.kill();
				}
			});
			worker('ping');
		}
	});
};

// This spawns a basic http server which just serves the client-side script.
// This is done just to keep everything in the example inside one file,
// in real life, you should serve your scripts out of a more respectable server.
var script = "	queenSocket.onMessage = function(message){";
script += "			if(message === 'ping'){";
script += "				queenSocket('pong');";
script += "			}";
script += "		};";

var server = require('http').createServer(function(request, response){
	response.writeHead(200, {'Content-Type': 'application/javascript'});
	response.end(script);
}).listen('9234', onServerReady);