var _ = require("underscore");
var createLogger = require("./logger.js").create;
var EventEmitter = require("events").EventEmitter;
var useragent = require("useragent");
var createWorker = require("./worker.js").create;
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
	this._workers = {};
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
	if(this._socket === socket){
		return; // same socket as existing one
	}

	if(this._socket !== void 0){
		// Disconnect from existing socket
		this._logger.debug("Disconnected from socket");
		socket.removeListener("setAvailability", this.setAvailability);
		socket.removeListener("setAttributes", this.setAttributes);
		socket.removeListener("kill", this.kill);
		socket.removeListener("workerEvent", this._workerEventHandler);
	}

	this._socket = socket;
	if(socket !== void 0){
		socket.on("setAvailability", this.setAvailability);
		socket.on("setAttributes", this.setAttributes);
		socket.on("kill", this.kill);
		socket.on("workerEvent", this._workerEventHandler);	
		socket.on("pong", function(){
			console.log("pong");
			socket.emit("ping");
		});
		socket.emit("ping");
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

Browser.prototype.spawnWorker = function(initializationData){
	var worker = createWorker(),
		data = {
			id: worker.getId(),
			initializationData: initializationData
		},
		worker;

	this._logger.debug("Spawned worker " + data.id);

	this._connectWorker(worker);

	this._socket.emit("spawnWorker", data);

	return worker.getSocket();
};

Browser.prototype._connectWorker = function(worker){
	var self = this,
		workerId = worker.getId();

	this._workers[workerId] = worker;

	worker.on("commandEvent", function(command, data){
		self._socket.emit("workerCommand", {
			id: workerId,
			command: command,
			data: data
		});
	});

	worker.on("dead", function(){
		self._disconnectWorker(worker);
	});

	this._logger.debug("Connected worker " + workerId);
};

Browser.prototype._disconnectWorker = function(worker){
	var workerId = worker.getId();
	
	this._logger.debug("Disconnected worker " + workerId);

	delete this._workers[workerId];
};

Browser.prototype._workerEventHandler = function(data){
	var workerId = data.workerId,
		event = data.event,
		data = data.data,
		worker = this._workers[workerId];

	if(worker === void 0){
		console.log("missing worker");
		return;
	}
	console.log("worker found");
		
	worker.emit(event, data);
};