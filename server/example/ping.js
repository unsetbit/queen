var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	socketio = require("socket.io"),
	http = require('http'),
	createQueen = require("../lib/queen.js"),
	createStaticServer = require("../lib/staticServer.js").create;

var port = 80,
	hostname = "localhost",
	browserCapturePath = "/capture",
	httpServer = createStaticServer({port: port, hostname: hostname}),
	socketServer = socketio.listen(httpServer, {log: false}),
	socket = socketServer.of(browserCapturePath),
	queen = createQueen(socket, {logger:logger.info.bind(logger)});

queen({
	scripts: ['http://localhost/example/ping.js'],
	populate: "continuous",
	killOnStop: false
});
