var _ = require("underscore");
var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var useragent = require("useragent");
var createWorkerSocket = require("./workerSocket.js").create;
var uuid = require('node-uuid');

exports.create = create = function(attributes, socket){
	var emitter = new EventEmitter();
	var browser = new Browser(attributes, socket, emitter);
	return browser;
};

exports.Browser = Browser = function(attributes, socket, emitter){
	var self = this;

	if(socket === void 0){
		throw "A Browser requires a socket";
	}

	if(emitter === void 0){
		throw "A Browser requires an emitter";
	}
	
	this._id = uuid.v4();
	this._workerSockets = {};
	this._available = false;
	this._emitter = emitter;
	this._logger = createLogger({prefix: "Browser-" + this._id.substr(0,4) });

	this.setAvailability = _.bind(this.setAvailability, this);
	this.setAttributes = _.bind(this.setAttributes, this);
	this.kill = _.bind(this.kill, this);
	this._workerEventHandler = _.bind(this._workerEventHandler, this);
	
	this.setSocket(socket);
	this.setAttributes(attributes);
	this._logger.trace("Created");
};

Browser.prototype.getId = function(){
	return this._id;
};

Browser.prototype._setAttributesHandler = function(data){
	this.setAttributes(attributes);
	if(attributes.availableOnRegister){
		this._markAsAvailable();
	}
};

Browser.prototype.isAvailable = function(){
	return this._isAvailable;
};

Browser.prototype.setAvailability = function(availability){
	if(availability === void 0 || availability === this._isAvailable){
		return this._isAvailable;
	}

	if(availability === true){
		this._isAvailable = true;
		this._emitter.emit("available");
	} else {
		this._isAvailable = false;
		this._emitter.emit("unavailable");
	}
};

Browser.prototype.setSocket = function(socket){
	var self = this;
	if(this._socket === socket){
		return; // same socket as existing one
	}

	if(this._socket !== void 0){
		// Disconnect from existing socket
		this._logger.debug("Disconnected from socket");
		socket.removeListener("setAvailability", this.setAvailability);
		socket.removeListener("setAttributes", this.setAttributes);
		socket.removeListener("kill", this.kill);
		socket.removeListener("fromWorker", this._workerEventHandler);
	}

	this._socket = socket;
	if(socket !== void 0){
		socket.on("setAvailability", this.setAvailability);
		socket.on("setAttributes", this.setAttributes);
		socket.on("kill", this.kill);
		socket.on("fromWorker", this._workerEventHandler);	
		this._logger.debug("Connected to socket");
	}
};

Browser.prototype.getSocket = function(){
	return this._socket;
};

Browser.prototype.kill = function(){
	this._emitter.emit("dead");
};

Browser.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Browser.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

Browser.prototype.getAttributes = function(){
	return this._attributes;
};

Browser.prototype.setAttributes = function(attributes){
	attributes = attributes || {};
	this._attributes = attributes;
	if(attributes.availableOnRegister){
		this.setAvailability(true);
	};

	if(attributes.userAgent){
		var ua = useragent.parse(attributes.userAgent);
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

Browser.prototype.spawnWorkerSocket = function(initializationData){
	var workerSocket = createWorkerSocket(),
		data = {
			id: workerSocket.getId(),
			initializationData: initializationData
		};

	this._logger.debug("Spawned worker socket " + data.id);

	this._connectWorkerSocket(workerSocket);

	this._socket.emit("spawnWorker", data);

	return workerSocket;
};

Browser.prototype._connectWorkerSocket = function(workerSocket){
	var self = this,
		socketId = workerSocket.getId();

	this._workerSockets[socketId] = workerSocket;

	workerSocket.setEmitHandler(function (event, data){
		self._socket.emit("toWorker", {
			id: socketId,
			event: event,
			data: data
		});
	});

	workerSocket.on("done", function(){
		self._disconnectWorkerSocket(workerSocket);
	});

	this._logger.debug("Connected worker socket " + socketId);
};

Browser.prototype._disconnectWorkerSocket = function(workerSocket){
	var socketId = workerSocket.getId();
	
	this._logger.debug("Disconnected worker socket " + socketId);

	delete this._workerSockets[socketId];
};

Browser.prototype._workerEventHandler = function(data){
	var socketId = data.id,
		event = data.event,
		data = data.data,
		workerSocket = this._workerSockets[socketId];

	workerSocket.echo(event, data);
};