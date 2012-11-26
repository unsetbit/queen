var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var createClientWorkforce = require('./clientWorkforce.js').create;

exports.create = function(socket, minionMaster, options){
	options = options || {};

	var client = new Client(socket, minionMaster);
	
	// If logger exists, attach to it
	if(options.logger){
		client.setLogger(options.logger);
	}

	return client;
};

var Client = exports.Client = function(socket, minionMaster){
	precondition.checkDefined(socket, "Client requires a socket");

	this._emitter = new EventEmitter();
	this._socket = socket;
	this._minionMaster = minionMaster;
	this._remoteWorkforces = {};

	_.bindAll(this, "_dataHandler");

	this._socket.on('data', this._dataHandler);
};

Client.prototype._dataHandler = function(data){
	var remoteWorkforce;
	if(data.event === "start"){
		this._newWorkForce(data.remoteId, data.data);
	} else if(data.remoteId !== void 0){
		remoteWorkforce = this._remoteWorkforces[data.remoteId];
		remoteWorkforce.handleEvent(data.event, data.data);
	} else {
		console.log('unknown command!');
	}
};

Client.prototype._newWorkForce = function(remoteId, workforceConfig){
	var self = this,
		workforce = this._minionMaster.getWorkforce(workforceConfig.workerFilters),
		remoteWorkforce = createClientWorkforce(workforce, workforceConfig.eventsToListenFor);
	
	this._remoteWorkforces[remoteId] = remoteWorkforce;
	
	remoteWorkforce.on('emit', function(data){
		data.remoteId = remoteId;
		self._socket.write(data);
	});

	remoteWorkforce.on('dead', function(data){
		self._socket.write({
			remoteId: remoteId,
			event: 'dead'
		});
		self._removeWorkforce(remoteWorkforce);
	});

	this._echo('newRemoteWorkforce', remoteWorkforce);
	
	remoteWorkforce.start(workforceConfig.workerConfig, workforceConfig.timeout);
};

Client.prototype._removeWorkforce = function(workforce){
	var workforceId = workforce.getId();
	delete this._remoteWorkforces[remoteId];
};

// EVENT HANDLERS
Client.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Client.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

Client.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

// Optional logging helpers
Client.prototype.eventsToLog = [
	["info", "newRemoteWorkforce", "New remote workforce"],
	["debug", "socketTimeout", "Socket didn't register in time (timed out)"],
	["info", "socketDisconnected", "Socket disconnected"]
];

Client.prototype.setLogger = function(logger){
	var prefix = "[Client] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};