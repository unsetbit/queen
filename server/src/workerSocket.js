var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");
var uuid = require('node-uuid');

exports.create = create = function(){
	var emitter = new EventEmitter();
	var workerSocket = new WorkerSocket(emitter);

	return workerSocket;
};

exports.WorkerSocket = WorkerSocket = function(internalEmitter){
	var self = this;

	if(internalEmitter === void 0){
		throw "WorkerSocket must be started with an eventEmitter";
	}

	this._internalEmitter = internalEmitter;
	this._id = uuid.v4();
	this._logger = createLogger({prefix: "WorkerSocket-" + this._id.substr(0,4) });
};

WorkerSocket.prototype.getId = function(){
	return this._id;
};

WorkerSocket.prototype.on = function(event, callback){
	return this._internalEmitter.on(event, callback);
};

WorkerSocket.prototype.removeListener = function(event, callback){
	return this._internalEmitter.removeListener(event, callback);
};

WorkerSocket.prototype.echo = function(event, data){
	this._internalEmitter.emit(event, data);
};

WorkerSocket.prototype.setEmitHandler = function(func){
	if(!_.isFunction(func)){
		throw "Emitter must be a function";
	}

	this._emitHandler = func;
}

WorkerSocket.prototype._emitHandler = function(){};

WorkerSocket.prototype.emit = function(event, data){
	this._emitHandler(event, data);
};
