var _ = require("underscore");
var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var isSimilar = require("./utils.js").isSimilar;
var useragent = require("useragent");
var createWorkerSocket = require("./workerSocket.js").create;
var uuid = require('node-uuid');

exports.create = create = function(socket, options){
	var options = options || {},
		emitter = options.emitter || new EventEmitter(),
		logger = options.logger || createLogger({prefix: "Browser"}),
		browser = new Browser(socket, emitter, logger);
	
	if(options.attributes){
		browser.setAttributes(options.attributes);	
	}
	
	return browser;
};

exports.Browser = Browser = function(socket, emitter, logger){
	var self = this;

	if(socket === void 0){
		throw "A Browser requires a socket";
	}

	if(emitter === void 0){
		throw "A Browser requires an emitter";
	}
	
	this._id = uuid.v4();
	this._workerSockets = {};
	this._attributes = {};
	this._isConnected = true;
	this._workerSocketCount = 0;
	this._emitter = emitter;
	this._logger = logger;

	_.bindAll(this, "kill", "_workerEventHandler");

	this.setSocket(socket);

	this._emit("setId", this._id);
	this._logger.trace("Created");
};

Browser.prototype.getId = function(){
	return this._id;
};

Browser.prototype.isAvailable = function(){
	return this._isAvailable;
};

Browser.prototype.isConnected = function(){
	return this._isConnected;
};

Browser.prototype.setConnected = function(connected){
	if(connected === void 0 || connected === this._isConnected){
		return this._isConnected;
	}

	if(connected === true){
		this._isConnected = true;
		this._emitter.emit("connected");
		this._logger.debug("Connected");
	} else {
		this._isConnected = false;
		this._emitter.emit("disconnected");
		this._logger.debug("Disconnected");
	}
};

Browser.prototype.setSocket = function(socket){
	if(this._socket === socket){
		return; // same socket as existing one
	}

	if(this._socket !== void 0){
		this._socket.removeListener("fromWorker", this._workerEventHandler);			
		this._socket.removeListener("kill", this.kill);
		this._logger.debug("Disconnected from socket");
	}

	this._socket = socket;
	if(this._socket !== void 0){
		this._socket.on("fromWorker", this._workerEventHandler);			
		this._socket.on("kill", this.kill);
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

Browser.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

Browser.prototype.getAttribute = function(key){
	return this._attributes[key];
};

Browser.prototype.hasAttributes = function(attritbuteMap){
	return  isSimilar(attritbuteMap, this._attributes);
};

Browser.prototype.maxWorkerSocketCount = 100;
Browser.prototype.setAttributes = function(attributes){
	var ua;
	this._attributes = attributes || {};
	attributes.id = this._id;

	if(this._attributes.userAgent){
		ua = useragent.parse(attributes.userAgent);
		this._attributes.name = ua.toAgent();
		this._attributes.family = ua.family;
		this._attributes.os = ua.os;
		this._attributes.version = {
			major: ua.major,
			minor: ua.minor,
			path: ua.patch
		};
	}

	if(this._attributes.maxWorkerSocketCount){
		this.maxWorkerSocketCount = this._attributes.maxWorkerSocketCount;
	}
};

Browser.prototype.getAttributes = function(){
	return _.extend({}, this._attributes);
};

Browser.prototype.isAvailable = function(){
	return this._workerSocketCount < this.maxWorkerSocketCount;
};

Browser.prototype.spawnWorker = function(context){
	var self = this,
		workerSocket, 
		socketId,
		data;

	if(!this.isAvailable()){
		this._logger.warn("Unable to spawn worker socket because of reached limit");
		return;
	}

	this._workerSocketCount += 1;
	
	workerSocket = createWorkerSocket();
	socketId = workerSocket.getId();
	data = {
		id: socketId,
		context: context
	};

	workerSocket.on("emit", function(event, data){
		self._emitToWorker(socketId, event, data);
	});

	workerSocket.on("done", function(){
		self._disconnectWorkerSocket(workerSocket);
	});

	this._workerSockets[socketId] = workerSocket;
	this._logger.debug("Spawned worker socket " + socketId);

	this._emit("spawnWorker", data);
	this._emitter.emit("spawnedWorker", workerSocket);
	return workerSocket;
};

Browser.prototype._disconnectWorkerSocket = function(workerSocket){
	var socketId = workerSocket.getId();
	
	this._workerSocketCount -= 1;

	delete this._workerSockets[socketId];
	this._logger.debug("Disconnected worker socket " + socketId);
	this._emitter.emit("releasedWorker", workerSocket);
};

Browser.prototype._emit = function(event, data){
	this._socket.emit(event, data);
};

Browser.prototype._emitToWorker = function(socketId, event, data){
	var message = {
		id: socketId,
		event: event,
		data: data
	};
	this._emit("toWorker", message);
	this._emitter.emit("messageToWorker", message);
};

Browser.prototype._workerEventHandler = function(message){
	var socketId = message.id,
		event = message.event,
		data = message.data,
		workerSocket = this._workerSockets[socketId];
	
	if(workerSocket === void 0){ // No longer listening to this worker
		if(event !== "done"){
			this._logger.warn("Worker socket no longer exists, sending kill command to worker. Socket id " + socketId);
			this._emitToWorker(socketId, "kill");	
		}
		return;
	};

	this._emitter.emit("messageFromWorker", message);
	workerSocket.echo(event, data);
};

Browser.prototype.kill = function(){
	this._destroyWorkers();
};

Browser.prototype._destroyWorkers = function(){
	_.each(this._workerSockets, function(workerSocket){
		if(!workerSocket.isDone()){
			workerSocket.emit('kill');
			workerSocket.echo('done');	
		}
	});

	this._workerSockets = {};
};