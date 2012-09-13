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


workerHub.on("providersAvailable", function(){
	var workers = workerHub.spawnWorkers();
	workers.forEach(function(worker){
		worker.on("ping", function(){
			console.log("pong");
			worker.emit("pong", "pong");	
		});
	});
});