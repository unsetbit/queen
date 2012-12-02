var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	socketio = require("socket.io"),
	http = require('http'),
	createMinionMaster = require("../lib/minionMaster.js"),
	createControlServer = require("../lib/controlServer/server.js"),
	createRemoteMinionMaster = require("../lib/remote/minionMaster.js"),
	createStaticServer = require("../lib/staticServer.js").create;

var port = 80,
	hostname = "localhost",
	browserCapturePath = "/capture",
	httpServer = createStaticServer({port: port, hostname: hostname}),
	socketServer = socketio.listen(httpServer, {log: false}),
	socket = socketServer.of(browserCapturePath),
	minionMaster = createMinionMaster(socket, {logger:logger.info.bind(logger)}),
	controlServer = createControlServer(minionMaster),
	remoteMinionMaster = createRemoteMinionMaster();

remoteMinionMaster.on('workerProvider', function(){
	var workforce = minionMaster({
		scripts: ['http://localhost/ping.js'],
		timeout: 1000 * 6
	},
	function(worker){
		worker.on('ping', function(){
			console.log('ping');
			worker('pong');
			console.log('pong');
		});
	});
});
