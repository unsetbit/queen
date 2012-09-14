var createWorkerHub = require('../src/workerHub.js').create;
var createBrowserHub = require("../src/browserHub.js").create;
var createBrowserMonitorHub = require("../src/browserMonitorHub.js").create;
var socketio = require("socket.io");
var webServer = require("../src/webServer.js");
var logger = require("../src/logger.js");
var _ = require("underscore");
var server = webServer.create("80", "../../client");

logger.defaults.threshold =  4
var socketServer = socketio.listen(server, {
	logger: logger.create({prefix:'socket.io', threshold:2})
});

//var workerHub = createWorkerHub();
var browserHub = createBrowserHub(socketServer.of("/capture"));
var browserMonitorHub = createBrowserMonitorHub(socketServer.of("/monitor"));

browserHub.on("connected", function(browser){
	browserMonitorHub.connectBrowser(browser);
	
	_.each([0], function(){
		var worker = browser.spawnWorker({
			scripts: [
				'http://172.16.100.169/test/test1.js',
				'http://172.16.100.169/test/test2.js',
				'http://172.16.100.169/test/test3.js'
			]
		});

		worker.on("ready", function(){
			console.log("worker ready");
		});

		worker.on("complete", function(data){
			console.log("Worker Complete");
			console.log(data);
			worker.emit("kill");
		});

		worker.on("loaded", function(text){
			console.log("Worker loaded: "+ text);
		});

		worker.on("update", function(text){
			console.log("Worker update: "+ text);
		});
	});
//	workerHub.connectWorkerProvider(browser);
});

browserHub.on("disconnected", function(browser){
	browserMonitorHub.disconnectBrowser(browser);
//	workerHub.disconnectWorkerProvider(browser);
});
