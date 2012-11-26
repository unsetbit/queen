var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	jot = require('json-over-tcp'),
	precondition = require('precondition');

var createClient = require('./client.js').create,
	createWorkforceController = require('./workforceController.js').create;

exports.create = function(minionMaster, options){
	options = options || {};

	var port = options.port || 8099,
		hostname = options.hostname || "localhost",
		server = options.server || jot.createServer().listen(port, hostname),
		controlServer = new Server(minionMaster, server);
	
	// If logger exists, attach to it
	if(options.logger){
		controlServer.setLogger(options.logger);
	}

	return controlServer
};


var Server = exports.Server = function(minionMaster, server){
	precondition.checkDefined(minionMaster, "RemoteControlServer requires a minion master instance");
	precondition.checkDefined(server, "RemoteControlServer requires a tcp server");

	this._emitter = new EventEmitter();
	this._minionMaster = minionMaster;
	this._server = server;

	_.bindAll(this, "_connectionHandler");

	this._server.on('connection', this._connectionHandler);
};

Server.prototype._connectionHandler = function(socket){
	var client = createClient(socket, this._minionMaster, {logger: this._logger});
	this._emit('clientConnected', client);
};

// EVENT HANDLERS
Server.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Server.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

Server.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

// Optional logging helpers
Server.prototype.eventsToLog = [
	["info", "clientConnected", "Client connected"]
];

Server.prototype.setLogger = function(logger){
	var prefix = "[RemoteServer] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};