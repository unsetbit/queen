var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	useragent = require("useragent"),
	uuid = require('node-uuid'),
	precondition = require('precondition');

var isSimilar = require("./utils.js").isSimilar,
	createWorker = require("./worker.js").create,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = create = function(socket, options){
	var options = options || {},
		workerProvider = new BrowserWorkerProvider(socket);
	
	// If logger exists, attach to it
	if(options.logger){
		workerProvider.setLogger(options.logger);
	}

	if(options.attributes){
		workerProvider.setAttributes(options.attributes);	
	}
	
	return workerProvider;
};

exports.BrowserWorkerProvider = BrowserWorkerProvider = function(socket){
	precondition.checkDefined(socket, "Browser Worker Provider requires a socket");
	
	var self = this;
	
	this._id = uuid.v4();
	this._emitter = new EventEmitter();

	this._attributes = {};
	this._workerCount = 0;
	this._workers = {};

	_.bindAll(this, "_workerEventHandler");

	this._socket = socket;
	this._socket.on("workerEvent", this._workerEventHandler);
};

BrowserWorkerProvider.prototype.getId = function(){
	return this._id;
};

BrowserWorkerProvider.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;

	// Kill workers
	_.each(this._workers, function(workerSocket){
		workerSocket.kill();
	});

	this._workers = {};

	this._socket.removeListener("workerEvent", this._workerEventHandler);
	this._echo("dead");
	this._emitter.removeAllListeners();
	this._socket = void 0;
};

BrowserWorkerProvider.prototype.setAttributes = function(attributes){
	var ua;
	this._attributes = attributes = attributes || {};

	if(attributes.userAgent){
		ua = useragent.parse(attributes.userAgent);
		attributes.name = ua.toAgent();
		attributes.family = ua.family;
		attributes.os = ua.os;
		attributes.version = {
			major: ua.major,
			minor: ua.minor,
			path: ua.patch
		};
	}
};

BrowserWorkerProvider.prototype.getAttribute = function(key){
	return this._attributes[key];
};

BrowserWorkerProvider.prototype.getAttributes = function(){
	return _.extend({}, this._attributes);
};

BrowserWorkerProvider.prototype.hasAttributes = function(attributeMap){
	return isSimilar(attributeMap, this._attributes);
};

BrowserWorkerProvider.prototype.isAvailable = function(){
	return this._workerCount < this.maxWorkerCount;
};

BrowserWorkerProvider.prototype.maxWorkerCount = 100;

BrowserWorkerProvider.prototype.spawnWorker = function(workerConfig, timeout){
	var self = this,
		worker, 
		workerId,
		data;

	if(!this.isAvailable()){
		if(this._logger) this._logger.debug("Unable to spawn worker because of reached limit");
		
		return;
	}

	this._workerCount += 1;
	if(this._workerCount === this.maxWorkerCount){
		this._echo("unavailable");
	}

	worker = createWorker(this);
	workerId = worker.getId();

	data = {
		id: workerId,
		workerConfig: workerConfig,
		timeout: timeout
	};

	worker.on("emit", function(event, data){
		self._emitToWorker(workerId, event, data);
	});

	worker.on("dead", function(){
		self._disconnectWorkerSocket(worker);
	});

	this._workers[workerId] = worker;
	
	this._emit("spawnWorker", data);

	this._echo("workerConnected", worker);

	return worker;
};

BrowserWorkerProvider.prototype._disconnectWorkerSocket = function(worker){
	var workerId = worker.getId();
	
	this._workerCount -= 1;
	if(this._workerCount === (this.maxWorkerCount - 1)){
		this._echo("available");
	}

	delete this._workers[workerId];

	this._echo("workerDisconnected", worker);
};


BrowserWorkerProvider.prototype._emitToWorker = function(workerId, event, data){
	var message = {
		id: workerId,
		event: event,
		data: data
	};
	this._emit("toWorker", message);
};

BrowserWorkerProvider.prototype._workerEventHandler = function(message){
	var workerId = message.id,
		event = message.event,
		data = message.data,
		workerSocket = this._workers[workerId];
	
	if(workerSocket === void 0){ // No longer listening to this worker
		if(event !== "done"){
			this._echo("killingStaleSocket", workerId);
			this._emitToWorker(workerId, "kill");	
		}

		return;
	} 
	
	workerSocket.echo(event, data);
};

// Event Handlers
BrowserWorkerProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
	return this;
};

BrowserWorkerProvider.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
	return this;
};

BrowserWorkerProvider.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

BrowserWorkerProvider.prototype._emit = function(event, data){
	this._socket.emit(event, data);
};

// Logging
BrowserWorkerProvider.prototype.eventsToLog = [
	["debug", "dead", "Dead"],
	["info", "workerConnected", "Worker connected"],
	["info", "workerDisconnected", "Worker disconnected"],
	["warn", "killingStaleSocket", "Worker socket no longer exists, sending kill command to worker."],
	["info", "available", "Available to spawn more workers"],
	["warn", "unavailable", "Worker limit reached, can't spawn more workers"]
];

BrowserWorkerProvider.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[BrowserWorkerProvider-" + this.getId().substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};
