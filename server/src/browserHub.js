var logger = require("./logger.js");
var createLogger = logger.create;
var createBrowser = require("./browser.js").create;
var socketio = require("socket.io");
var webServer = require("./webServer.js");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var uuid = require('node-uuid');

exports.create = function(){
	var server = webServer.create("80", "../../client");

	logger.defaults.threshold =  4
	var socketServer = socketio.listen(server, {
		logger: logger.create({prefix:'socket.io', threshold:2})
	});
	
	var emitter = new EventEmitter();
	var browserHub = new BrowserHub(emitter);
	browserHub.attachToServer(socketServer);
	return browserHub;
};

exports.BrowserHub = BrowserHub = function(emitter){
	this._emitter = emitter;
	this._browsers = {};
	this._id = uuid.v4();
	this._connectionHandler = _.bind(this._connectionHandler, this);

	this._logger = createLogger({prefix: "BrowserHub-" + this._id.substr(0,4) });
	this._logger.trace("Created");
};

BrowserHub.prototype.registerationTimeout = 1000;
BrowserHub.prototype.reconnectionTimeout = 2000;

BrowserHub.prototype.getId = function(){
	return this._id;
};

BrowserHub.prototype.attachToServer = function(server){
	var self = this;
		
	server.on("connection", self._connectionHandler);
};

BrowserHub.prototype.detachFromServer = function(server){
	server.removeListener("connection", this._connectionHandler);
};

BrowserHub.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

BrowserHub.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

BrowserHub.prototype._connectionHandler = function(socket){
	var self = this,
		browser,
		browserId,
		registered = false;

	socket.on("register", function(attributes){
		registered = true;
		var isNewBrowser = true;
		if(attributes && attributes.id && self._browsers[attributes.id] !== void 0){
			browserId = attributes.id;
			browser = self._browsers[attributes.id];
			browser.setAvailability(true);
			browser.setSocket(socket);
			isNewBrowser = false;

			self._logger.debug("Browser reconnected " + browserId);
		} else {
			browser = createBrowser(attributes, socket);
			browserId = browser.getId();
			socket.emit("reset", {id: browserId});
			
			self._browsers[browserId] = browser;
			self._logger.debug("New browser connected " + browserId);
			self._emitter.emit("connected", browser);
		}

		socket.on("disconnect", function(){
			if(browser.getSocket() === socket){
				self._disconnectHandler(browser);	
			}
		});
	});

	var killTime = new Date().getTime() + this.registerationTimeout;
	(function disconnectNonregistrants(){
		var now;

		if(registered){
			return;
		}

		now = new Date().getTime();

		if(now < killTime){
			process.nextTick(disconnectNonregistrants)
		} else {
			socket.emit("error", {
				fault: 'client',
				message: 'Client failed to register within ' + self.registerationTimeout + 'ms'
			});
			socket.disconnect();
			self._logger.info("Socket disconnected due to registeration timeout");
		}
	}());
};

BrowserHub.prototype._disconnectHandler = function(browser){
	var self = this,
		browserId = browser.getId();
	browser.isAvailable()
	var isBrowserAvailable = browser.isAvailable();

	browser.once("available", function(){
		isBrowserAvailable = true;
	});

	var killTime = new Date().getTime() + this.reconnectionTimeout;
	(function killIfNoReconnect(){
		var now;

		if(isBrowserAvailable){
			return;
		}

		now = new Date().getTime();

		if(now < killTime){
			process.nextTick(killIfNoReconnect)
		} else {
			delete self._browsers[browserId];
			self._logger.info("Browser deleted due to reconnection timeout");
			self._emitter.emit("disconnected", browser);
		}
	}());
};