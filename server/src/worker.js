var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");
var uuid = require('node-uuid');

exports.create = create = function(){
	var emitter = new EventEmitter();
	var workEventEmitter = new EventEmitter();
	var worker = new Worker(emitter, workEventEmitter);

	return worker;
};

exports.Worker = Worker = function(emitter, workEventEmitter){
	var self = this;

	if(emitter === void 0){
		throw "Worker must be started with an emitter";
	}

	if(workEventEmitter === void 0){
		throw "Worker must be started with a workEventEmitter";
	}

	this._workEventEmitter = workEventEmitter;
	this._emitter = emitter;
	this._id = uuid.v4();
	this._logger = createLogger({prefix: "Worker-" + this._id.substr(0,4) });
	this._socket = {
		on: _.bind(this._workEventEmitter.on, this._workEventEmitter),
		removeListener: _.bind(this._workEventEmitter.removeListener, this._workEventEmitter),
		emit: _.bind(this._emitCommandEvent, this)
	};
};

Worker.prototype.getId = function(){
	return this._id;
};

Worker.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

Worker.prototype.emit = function(event, data){
	this._logger.trace("Emitting: " + event);
	this._workEventEmitter.emit(event, data);
};

Worker.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

Worker.prototype._emitCommandEvent = function(event, data){
	return this._emitter.emit("commandEvent", event, data);
};

Worker.prototype.getSocket = function(){
	return this._socket;
};
