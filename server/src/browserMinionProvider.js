var createLogger = require("./logger.js").create;
var inherits = require("util").inherits;
var EventEmitter = require("events").EventEmitter;
var useragent = require("useragent");
var _ = require("underscore");

exports.create = create = function(socket){
	var emitter = new EventEmitter()
	var minionProvider = new BrowserMinionProvider(socket, emitter);
	return minionProvider;
};

var idCounter = 0;
exports.BrowserMinionProvider = BrowserMinionProvider = function(socket, emitter){
	var self = this;

	if(socket === void 0){
		throw "A BrowserMinionProvider requires a socket";
	}

	if(emitter === void 0){
		throw "A BrowserMinionProvider requires an emitter";
	}
	
	this._id = idCounter++;
	this._minionIdCounter = 0;
	this._minions = [];
	this._attributes = {};
	this._available = false;
	this._socket = socket;
	this._emitter = emitter;
	this._logger = createLogger({prefix: "BrowserMinionProvider-" + this._id });
	
	this._socket.on("available", function(){
		self._markAsAvailable();
	});
	
	this._socket.on("unavailable", function(){
		self._markAsUnavailable();
	});

	this._socket.on("setAttributes",  function(attributes){
		self.setAttributes(attributes);
		if(attributes.availableOnRegister){
			self._markAsAvailable();
		}
	});

	this._logger.trace("Created");
};

BrowserMinionProvider.prototype._markAsAvailable = function(){
	this._available = true;
	this._emitter.emit("available");
	this._logger.debug("Now available");
};

BrowserMinionProvider.prototype._markAsUnavailable = function(){
	this._available = false;
	this._emitter.emit("unavailable");
	this._logger.debug("Now unavailable");
};

BrowserMinionProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

BrowserMinionProvider.prototype.getAttributes = function(){
	return this._attributes;
};

BrowserMinionProvider.prototype.setAttributes = function(attributes){
	this._attributes = attributes;

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

BrowserMinionProvider.prototype.getMinion = function(){
	var minionSocketId = "/minion/" + this._minionIdCounter++;
	var minionSocket = this._socket.of(minionSocketId);
	
	var data = {
		socketId: minionSocketId,
		data: ""
	};

	this._socket.emit("createMinion", data);
	return minionSocket;
};