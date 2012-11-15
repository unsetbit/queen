var socketio = require("socket.io"),
	http = require('http'),
	EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	uuid = require('node-uuid');

var createClientHub = require('./clientHub.js').create,
	createStaticServer = require('./staticServer.js').create;

exports.create = create = function(options){
	var options = options || {},
		logger = options.logger,
		port = options.port || 80,
		hostName = options.hostName || "localhost",
		browserCapturePath = options.browserCapturePath || "/capture",
		captureUrl = options.captureUrl || "http://" + hostName + ":" + port + browserCapturePath + ".html",
		httpServer = options.httpServer || createStaticServer({port: port, captureUrl: captureUrl}),
		socketServer = options.socketServer || socketio.listen(httpServer, {log: false}),
		clientHub = options.clientHub || createClientHub(socketServer.of(browserCapturePath), {logger: logger}),
		minionMaster = new MinionMaster(clientHub);

	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(clientHub){
	var self = this;

	this._emitter = new EventEmitter();
	this._clientHub = clientHub;

	this._clientHub.on("clientConnected", function(client){
		self._emit("clientConnected", client);
	});

	this._clientHub.on("clientDisconnected", function(client){
		self._emit("clientDisconnected", client);
	});
};

MinionMaster.prototype.kill = function(callback){
	this._clientHub.kill();
};

// EVENT HANDLERS
MinionMaster.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

MinionMaster.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

MinionMaster.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

MinionMaster.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

