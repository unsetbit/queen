var EventEmitter = require("events").EventEmitter,
	precondition = require('precondition'),
	_ = require("underscore"),
	uuid = require('node-uuid');

exports.create = create = function(provider, options){
	var options = options || {},
		worker = new Worker(provider);

	return worker;
};

exports.Worker = Worker = function(provider){
	var self = this;
	
	this._id = uuid.v4();
	this._provider = provider;
	this._emitter = new EventEmitter();
};


Worker.prototype.getId = function(){
	return this._id;
};

Worker.prototype.getAttributes = function(){
	return this._provider.getAttributes();
};

Worker.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

Worker.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

Worker.prototype.echo = function(event, data){
	return this._emitter.emit(event, data);
};

Worker.prototype.emit = function(event, data){
	return this._emitter.emit("emit", event, data);
};

Worker.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;
	
	this.emit('kill');
	this.echo('dead');
	this._emitter.removeAllListeners();
};
