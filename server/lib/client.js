var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	useragent = require("useragent"),
	uuid = require('node-uuid'),
	precondition = require('precondition');

var isSimilar = require("./utils.js").isSimilar,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = create = function(socket, options){
	var options = options || {},
		attributes = options.attributes,
		client = new Client(socket);
	
	// If logger exists, attach to it
	if(options.logger){
		client.setLogger(options.logger);
	}

	if(options.attributes){
		client.setAttributes(options.attributes);	
	}
	
	return client;
};

exports.Client = Client = function(socket){
	precondition.checkDefined(socket, "Client requires a socket");
	
	var self = this;
	
	this._id = uuid.v4();
	this._emitter = new EventEmitter();
	this._attributes = {};
	
	_.bindAll(this, "_killHandler", "_echoHandler");

	this._socket = socket;
	this._socket.on("echo", this._echoHandler);
	this._socket.on("kill", this._killHandler);
};

Client.prototype.getId = function(){
	return this._id;
};

Client.prototype._killHandler = function(){
	this.kill();
};

Client.prototype.kill = function(){
	this._socket.removeListener("echo", this._echoHandler);
	this._socket.removeListener("kill", this._killHandler);
	this._echo("dead");
	this._emitter.removeAllListeners();
	this._socket = void 0;
};

Client.prototype.setAttributes = function(attributes){
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

Client.prototype.getAttribute = function(key){
	return this._attributes[key];
};

Client.prototype.getAttributes = function(){
	return _.extend({}, this._attributes);
};

Client.prototype.hasAttributes = function(attributeMap){
	return isSimilar(attributeMap, this._attributes);
};

Client.prototype.emit = function(event, data){
	this._socket.emit('trigger', {
		event: event,
		data: data
	});
};

Client.prototype._echoHandler = function(data){
	var event = data.event,
		eventData = data.data;

	this._echo(event, eventData);
};

// Event Handlers
Client.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Client.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

Client.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

// Logging
Client.prototype.eventsToLog = [
	["debug", "dead", "Dead"]
];

Client.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[Client-" + this.getId().substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};
