var	uuid = require('node-uuid'),
	EventEmitter = require('events').EventEmitter;

exports.create = function(id, attributes){
	var worker = new Worker(id);
	return worker;
};

var Worker = exports.Worker = function(id, attributes){
	this._id = id;
	this._attributes = attributes;
	this._emitter = new EventEmitter();
};

Worker.prototype.getId = function(){
	return this._id;
};

Worker.prototype.getAttributes = function(){
	return this._attributes;
};

Worker.prototype.echo = function(event, data){
	this._emitter.emit(event, data);
};

Worker.prototype.emit = function(event, data){
	this._emitter.emit('emit', {
		event: event,
		data: data
	});
};

// EVENT HANDLERS
Worker.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
	return this;
};

Worker.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
	return this;
};