var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");
var uuid = require('node-uuid');

exports.create = create = function(options){
	var options = options || {},
		emitter = options.emitter || new EventEmitter(),
		logger = options.logger || createLogger({prefix: "WorkerSocket"}),
		workerSocket = new WorkerSocket(emitter, logger);

	return workerSocket;
};

exports.WorkerSocket = WorkerSocket = function(emitter, logger){
	var self = this;

	if(emitter === void 0){
		throw "WorkerSocket requires an emitter";
	}

	if(logger === void 0){
		throw "WorkerSocket requires a logger";
	}

	this._emitter = emitter;
	this._isDone = false;
	this._id = uuid.v4();
	this._logger = logger;

	this.on("done", function(){
		this._isDone = true;
	});

	this._logger.trace("Created");
};

WorkerSocket.prototype.getId = function(){
	return this._id;
};

WorkerSocket.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

WorkerSocket.prototype.once = function(event, callback){
	return this._emitter.once(event, callback);
};

WorkerSocket.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

WorkerSocket.prototype.echo = function(event, data){
	return this._emitter.emit(event, data);
};

WorkerSocket.prototype.emit = function(event, data){
	return this._emitter.emit("emit", event, data);
};

WorkerSocket.prototype.isDone = function(){
	return this._isDone;
};