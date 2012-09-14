var createLogger = require("./logger.js").create;
var isSimilar = require("./utils.js").isSimilar;
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var uuid = require('node-uuid');

exports.create = function(){
	var emitter = new EventEmitter();
	var workerHub = new WorkerHub(emitter);
	return workerHub;
};

exports.WorkerHub = WorkerHub = function(emitter){
	var self = this;

	if(emitter === void 0){
		throw "WorkerHub must be started with an emitter";
	}

	this._id = uuid.v4();
	this._workerProviders = {};	
	this._emitter = emitter;

	this._logger = createLogger({prefix: "WorkerHub-" + this._id.substr(0,4) });
	this._logger.trace("Created");
};

WorkerHub.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkerHub.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

WorkerHub.prototype.spawnWorkers = function(workerFilters, data){
	if(!_.isArray(workerFilters)){
		workerFilters = [workerFilters];
	}

	var sockets = [];
	_.each(this._workerProviders, function(provider){
		var filterMatch = _.any(workerFilters, function(workerFilter){
			return provider.hasAttributes(workerFilter);
		});

		if(filterMatch){
			var socket = provider.spawnWorker(data);
			if(socket !== void 0){
				sockets.push(socket);	
			}
		}
	});

	return sockets;
};

WorkerHub.prototype.connectWorkerProvider = function(provider){
	var self = this,
		providerId = provider.getId();

	if(this._workerProviders[providerId] === void 0){
		this._workerProviders[providerId] = provider;
		
		this._logger.debug("Connected worker provider: " + providerId);
		this._emitter.emit("connectedWorkerProvider", provider);
	}
};

WorkerHub.prototype.disconnectWorkerProvider = function(provider){
	var self = this,
		providerId = provider.getId();

	if(this._workerProviders[providerId] !== void 0){
		delete this._workerProviders[providerId];

		this._logger.debug("Disconnected worker provider: " + providerId);
		this._emitter.emit("disconnectedWorkerProvider", provider);
	}
};
