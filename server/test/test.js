var createWorkerHub = require('../src/workerHub.js').create;
var createBrowserHub = require("../src/browserHub.js").create;
var createBrowserMonitorHub = require("../src/browserMonitorHub.js").create;
var socketio = require("socket.io");
var webServer = require("../src/webServer.js");
var logger = require("../src/logger.js");

var server = webServer.create("80", "../../client");

logger.defaults.threshold =  4
var socketServer = socketio.listen(server, {
	logger: logger.create({prefix:'socket.io', threshold:2})
});

var workerHub = createWorkerHub();
var browserHub = createBrowserHub(socketServer.of("/capture"));
var browserMonitorHub = createBrowserMonitorHub(socketServer.of("/monitor"));

browserHub.on("connected", function(browser){
	browserMonitorHub.connectBrowser(browser);
	workerHub.connectWorkerProvider(browser);
});

browserHub.on("disconnected", function(browser){
	browserMonitorHub.disconnectBrowser(browser);
	workerHub.disconnectWorkerProvider(browser);
});

workerHub.on("connectedWorkerProvider", function(){
	var workerGroup1 = workerHub.spawnWorkers();
	var workerGroup2 = workerHub.spawnWorkers();
	var workerGroup3 = workerHub.spawnWorkers();
	var workers = workerGroup1.concat(workerGroup2).concat(workerGroup3);

	workers.forEach(function(worker){
		var pongCount = 0;
		worker.on("ping", function(time){
			console.log("client " + time);
			pongCount++;
			if(pongCount === 10){
				pongCount = 0;
				worker.emit("kill");	
			}
		});

		var workerDone = false;
		worker.on("done", function(){
			workerDone = true;
		});

		var fireWhen = new Date().getTime();
		(function poller(){
			var now;

			if(workerDone){
				return;
			}

			now  = new Date().getTime();
			if(now > fireWhen){
				console.log("server " + now);
				worker.emit("pong", now);
				fireWhen = now + 3000;
			}
			
			process.nextTick(poller);	
		}());
		// Do work
	});
});