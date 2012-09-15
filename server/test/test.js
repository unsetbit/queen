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
var browserHub = createBrowserHub({server: socketServer.of("/capture")});
//var browserMonitorHub = createBrowserMonitorHub(socketServer.of("/monitor"));

browserHub.on("connected", function(browser){
	//browserMonitorHub.connectBrowser(browser);
	
	var workerSocket = browser.spawnWorker({
		scripts: [
			'http://172.16.100.169/test/test1.js'
		]
	});

	workerSocket.on("ready", function(){
		workerSocket.emit("eval", "createAlert();");
	});

	workerSocket.on("complete", function(data){
		console.log("Worker Complete");
		workerSocket.emit("kill");
	});

//	workerHub.connectWorkerProvider(browser);
});

browserHub.on("disconnected", function(browser){
	//browserMonitorHub.disconnectBrowser(browser);
//	workerHub.disconnectWorkerProvider(browser);
});
