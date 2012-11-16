var EventEmitter = require("events").EventEmitter,
	precondition = require('precondition'),
	_ = require("underscore"),
	uuid = require('node-uuid');

exports.create = create = function(provider, options){
	var options = options || {},
		workerSocket = new WorkerSocket(provider);

	return workerSocket;
};

exports.WorkerSocket = WorkerSocket = function(provider){
	var self = this;
	
	this._id = uuid.v4();
	this._provider = provider;
	this._emitter = new EventEmitter();
};


WorkerSocket.prototype.getId = function(){
	return this._id;
};

WorkerSocket.prototype.getProvider = function(){
	return this._provider;
};

WorkerSocket.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
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

WorkerSocket.prototype.kill = function(){
	this.emit('kill');
	this.echo('done');
	this.echo('dead');
	this._emitter.removeAllListeners();
};
