var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	jot = require('json-over-tcp'),
	precondition = require('precondition');

var createWorkforce = require('./workforce.js').create,
	logEvents = require("../utils.js").logEvents,
	stopLoggingEvents = require("../utils.js").stopLoggingEvents;

exports.create = function(options){
	options = options || {};

	var port = options.port || 8099,
		hostname = options.hostname || "localhost",
		socket = options.socket ||new jot.Socket(),
		minionMaster = new MinionMaster(socket);
	
	// If logger exists, attach to it
	if(options.logger){
		minionMaster.setLogger(options.logger);
	}

	socket.connect(port, hostname);

	return minionMaster;
};

var MinionMaster = exports.MinionMaster = function(socket){
	precondition.checkDefined(socket, "RemoteMinionMaster requires a socket");
	var self = this;
	this._emitter = new EventEmitter();
	this._socket = socket;
	this._workforces = {};
	this._connected = false;
	
	_.bindAll(this, "_dataHandler");

	this._socket.on('connect', function(){
		self._echo('connected');
		self._connected = true;
	});

	this._socket.on('end', function(){
		self._echo('disconnected');
		self._connected = false;
	});

	this._socket.on('data', this._dataHandler);
};

MinionMaster.prototype.getWorkforce = function(workerFilters){
	var self = this,
		workforce = createWorkforce(workerFilters, {logger: this._logger}),
		workforceId = workforce.getId();

	this._workforces[workforceId] = workforce;
	workforce.on('dead', function(){
		self._removeWorkforce(workforce);
	});

	workforce.on('emit', function(data){
		data.remoteId = workforceId;
		self._emit(data);
	});

	this._echo("workforceCreated", workforce);
	
	return workforce;
};

MinionMaster.prototype._removeWorkforce = function(workforce){
	var workforceId = workforce.getId();
	delete this._workforces[workforceId];
};

MinionMaster.prototype._dataHandler = function(data){
	var remoteId = data.remoteId;
	if(remoteId === void 0){
		return; // invalid data
	}

	var workforce = this._workforces[remoteId];
	if(workforce === void 0){
		return; // invalid data
	}

	workforce.handleEvent(data.event, data.data);
};

// EVENT HANDLERS
MinionMaster.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

MinionMaster.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

MinionMaster.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

MinionMaster.prototype._emit = function(data){
	var self = this;

	if(this._connected){
		this._socket.write(data);
	} else {
		this._socket.once('connect', function(){
			self._socket.write(data);
		});
	}
};

// Optional logging helpers
MinionMaster.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["debug", "disconnected", "Disconnected"],
	["info", "workforceCreated", "Workforce created"]
];

MinionMaster.prototype.setLogger = function(logger){
	var prefix = "[RemoteClient] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};