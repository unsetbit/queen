var createWorkerHub = require('../src/workerHub.js').create;
var createBrowserHub = require("../src/browserHub.js").create;

var workerHub = createWorkerHub();
var browserHub = createBrowserHub();

browserHub.on("connected", function(browser){
	workerHub.connectWorkerProvider(browser);
});

browserHub.on("disconnected", function(browser){
	workerHub.disconnectWorkerProvider(browser);
});

var pongCount = 0
workerHub.on("connectedWorkerProvider", function(){
	var workers = workerHub.spawnWorkers();
	workers.forEach(function(worker){
		// Do work
	});
});