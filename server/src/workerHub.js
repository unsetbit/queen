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

	this._workerProviders = {};	
	this._id = uuid.v4();
	this._emitter = emitter;
	this._availableProviders = 0;

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

	var workers = [];
	_.each(this._workerProviders, function(provider){
		var filterMatch = _.any(workerFilters, function(workerFilter){
			var workerAttributes = provider.getAttributes();
			return isSimilar(workerFilter, workerAttributes);
		});

		if(filterMatch){
			var socket = provider.spawnWorker(data);
			workers.push(socket);
		}
	});

	return workers;
};

WorkerHub.prototype.hasWorkerProvider = function(provider){
	return this._workerProviders[provider.getId()] !== void 0;
};

WorkerHub.prototype.connectWorkerProvider = function(provider){
	var self = this,
		providerId = provider.getId();

	if(this._workerProviders[providerId] === void 0){
		this._workerProviders[providerId] = provider;
		
		this._logger.debug("Connected worker provider: " + providerId);
		this._emitter.emit("connectedWorkerProvider", provider);
		if(provider.isAvailable()){
			if(this._availableProviders === 0){
				self._emitter.emit("providersAvailable");
			}

			this._availableProviders += 1;
		}

		provider.on("available", function(){
			if(this._availableProviders === 0){
				self._emitter.emit("providersAvailable");
			}
			this._availableProviders += 1;
		});

		provider.on("unavailable", function(){
			this._availableProviders -= 1;
			if(this._availableProviders === 0){
				self._emitter.emit("providersUnavailable");
			}
		});
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
