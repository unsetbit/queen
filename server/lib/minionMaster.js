var socketio = require("socket.io"),
	http = require('http'),
	EventEmitter = require('events').EventEmitter,
	_ = require('underscore');

var createBrowserHub = require('./browserHub.js').create;

exports.create = create = function(options){
	var options = options || {},
		logger = options.logger,
		browserCapturePath = options.browserCapturePath || "/capture",
		port = options.port || 80,
		httpServer = options.httpServer || http.createServer().listen(port),
		socketServer = options.socketServer || socketio.listen(httpServer, {logger: logger}),
		browserHub = options.browserHub || createBrowserHub({server: socketServer.of(browserCapturePath), logger:logger}),
		minionMaster = new MinionMaster(httpServer, socketServer, browserHub);

	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(httpServer, socketServer, browserHub){
	this._socketServer = socketServer;
	this._browserHub = browserHub;
	this._httpServer = httpServer;
};

MinionMaster.prototype.getHttpServer = function(){
	return this._httpServer;
};


MinionMaster.prototype.getBrowserHub = function(){
	return this._browserHub;
};