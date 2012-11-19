var _ = require("underscore"),
	uuid = require("node-uuid"),
	precondition = require('precondition');

var EventEmitter = require("events").EventEmitter;
var createWorkerSocket = require("./worker.js").create;

var	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = create = function(client, options){
	var options = options || {},
		workerProvider = new WorkerProvider(client);

	if(options.logger){
		workerProvider.setLogger(options.logger);
	}

	return workerProvider;
};

exports.WorkerProvider = WorkerProvider = function(client){
	precondition.checkDefined(client, "WorkerProvider requires a browser");

	this._id = uuid.v4();
	this._emitter = new EventEmitter();

	this._client = client;
	this._workerSockets = {};
	this._workerSocketCount = 0;

	_.bindAll(this, "_workerEventHandler", 
					"_clientDeadHandler");

	this._client.on("workerProvider:fromWorker", this._workerEventHandler);
	this._client.on("dead", this._clientDeadHandler);
};

WorkerProvider.prototype.getId = function(){
	return this._id;
};

WorkerProvider.prototype.hasAttributes = function(attributes){
	return this._client.hasAttributes(attributes);
};

WorkerProvider.prototype.getAttributes = function(attributes){
	return this._client.getAttributes();
}

WorkerProvider.prototype.isAvailable = function(){
	return this._workerSocketCount < this.maxWorkerCount;
};

WorkerProvider.prototype.maxWorkerCount = 100;

WorkerProvider.prototype._emit = function(event, data){
	this._client.emit(event, data);
};

WorkerProvider.prototype._emitToWorker = function(socketId, event, data){
	var message = {
		id: socketId,
		event: event,
		data: data
	};
	this._emit("workerProvider:toWorker", message);
};

WorkerProvider.prototype._workerEventHandler = function(message){
	var socketId = message.id,
		event = message.event,
		data = message.data,
		workerSocket = this._workerSockets[socketId];
	
	if(workerSocket === void 0){ // No longer listening to this worker
		if(event !== "done"){
			this._echo("killingStaleSocket", socketId);
			this._emitToWorker(socketId, "kill");	
		}

		return;
	} 
	
	workerSocket.echo(event, data);
};

WorkerProvider.prototype._clientDeadHandler = function(){
	this.kill();
};

WorkerProvider.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;
	
	this._destroyWorkers();

	this._client.removeListener("workerProvider:fromWorker", this._workerEventHandler);
	this._client.removeListener("dead", this._destroyWorkers);
	this._client = void 0;
	this._echo('dead');
	this._emitter.removeAllListeners();
};

WorkerProvider.prototype._destroyWorkers = function(){
	_.each(this._workerSockets, function(workerSocket){
		workerSocket.kill();
	});

	this._workerSockets = {};
};

WorkerProvider.prototype.spawnWorker = function(workerConfig, timeout){
	var self = this,
		workerSocket, 
		socketId,
		data;

	if(!this.isAvailable()){
		if(this._logger) this._logger.debug("Unable to spawn worker socket because of reached limit");
		
		return;
	}

	this._workerSocketCount += 1;
	if(this._workerSocketCount === this.maxWorkerCount){
		this._echo("unavailable");
	}

	workerSocket = createWorkerSocket(this);
	socketId = workerSocket.getId();

	data = {
		id: socketId,
		workerConfig: workerConfig,
		timeout: timeout
	};

	workerSocket.on("emit", function(event, data){
		self._emitToWorker(socketId, event, data);
	});

	workerSocket.on("dead", function(){
		self._disconnectWorkerSocket(workerSocket);
	});

	this._workerSockets[socketId] = workerSocket;
	
	this._emit("workerProvider:spawnWorker", data);

	this._echo("workerConnected", workerSocket);

	return workerSocket;
};

WorkerProvider.prototype._disconnectWorkerSocket = function(workerSocket){
	var socketId = workerSocket.getId();
	
	this._workerSocketCount -= 1;
	if(this._workerSocketCount === (this.maxWorkerCount - 1)){
		this._echo("available");
	}

	delete this._workerSockets[socketId];

	this._echo("workerDisconnected", workerSocket);
};

// EVENTS
WorkerProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkerProvider.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

WorkerProvider.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

// Logging
WorkerProvider.prototype.eventsToLog = [
	["info", "workerConnected", "Worker connected"],
	["info", "workerDisconnected", "Worker disconnected"],
	["warn", "killingStaleSocket", "Worker socket no longer exists, sending kill command to worker."],
	["info", "available", "Available to spawn more workers"],
	["warn", "unavailable", "Worker limit reached, can't spawn more workers"]
];

WorkerProvider.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[WorkerProvider-" + this.getId().substr(0,4) + " ] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};

