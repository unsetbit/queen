var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	uuid = require('node-uuid');

var createBrowser = require("./browser.js").create,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = function(options){
	var options = options || {},
		emitter = options.emitter || new EventEmitter(),
		browserHub = new BrowserHub(emitter, options.logger);

	// If logger exists, attach to it
	if(options.logger){
		browserHub.setLogger(options.logger);
	}
	
	if(options.server){
		browserHub.attachToServer(options.server);	
	}


	return browserHub;
};

exports.BrowserHub = BrowserHub = function(emitter){
	if(emitter === void 0){
		throw "BrowserHub requires an emitter";
	}

	this._emitter = emitter;
	this._browsers = {};
	this._id = uuid.v4();
	
	this._logger = void 0;
	this._loggingFunctions = void 0; // Keeps track of bound logging functions

	_.bindAll(this, "_connectionHandler");
};

// DEFAULT ATTRIBUTES
BrowserHub.prototype.registerationTimeout = 2000;
BrowserHub.prototype.reconnectionTimeout = 1000;
BrowserHub.prototype.eventsToLog = [
	["info", "attachedToServer", "Attached to server"],
	["info", "detachedFromServer", "Detached from server"],
	["debug", "socketConnected", "Socket connected"],
	["debug", "socketDisconnected", "Socket disconnected"],
	["info", "clientConnected", "Browser connected"],
	["debug", "browserReconnected", "Browser reconnected"],
	["info", "clientDisconnected", "Browser disconnected"]
];

BrowserHub.prototype.setLogger = function(logger){
	var prefix = "[BrowserHub-" + this.getId().substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};

BrowserHub.prototype.attachToServer = function(server){
	server.on("connection", this._connectionHandler);
	this._emit("attachedToServer", server);
};

BrowserHub.prototype.detachFromServer = function(server){
	server.removeListener("connection", this._connectionHandler);
	this._emit("detachedFromServer", server);
};

BrowserHub.prototype.getBrowsers = function(filters){
	if(!_.isArray(filters)){
		filters = [filters];
	}

	var browsers = _.filter(this._browsers, function(browser){
		return _.any(filters, function(filter){
			return browser.hasAttributes(filter);
		});
	});

	return browsers;
};

BrowserHub.prototype.getId = function(){
	return this._id;
};

// EVENT HANDLERS
BrowserHub.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

BrowserHub.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

BrowserHub.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

// BROWSER CONNECTION HANDLERS
BrowserHub.prototype._browserConnectHandler = function(browser){
	browserId = browser.getId();
	this._browsers[browserId] = browser;
	this._emit("clientConnected", browser);
};

BrowserHub.prototype._browserReconnectHandler = function(browser, socket){
	browser.setSocket(socket);
	browser.setConnected(true);
	socket.emit("reconnected");
	this._emit("browserReconnected", browser);
};

BrowserHub.prototype._browserDisconnectHandler = function(browser){
	var browserId = browser.getId();
	browser.kill();
	delete this._browsers[browserId];

	this._emit("clientDisconnected", browser);
};

// SOCKET CONNECTION HANDLERS
BrowserHub.prototype._connectionHandler = function(socket){
	var self = this,
		browser,
		browserId,
		registered = false;
	
	self._emit("socketConnected", socket);
	
	socket.on("register", function(registerationData){
		registered = true;
		if(registerationData && registerationData.id && self._browsers[registerationData.id] !== void 0){
			browser = self._browsers[registerationData.id];
			self._browserReconnectHandler(browser, socket);
		} else {
			browser = createBrowser(socket, {attributes: registerationData, logger: self._logger});
			self._browserConnectHandler(browser);
		}

		socket.on("disconnect", function(){
			if(browser.getSocket() === socket){
				self._disconnectHandler(browser);	
			}
		});
	});

	// Kill sockets that don't register fast enough
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
			self._emit("socketDisconnected");
		}
	}());
};


BrowserHub.prototype._disconnectHandler = function(browser){
	var self = this,
		browserId = browser.getId(),
		isBrowserConnected = false;
	
	browser.setConnected(false);
	browser.once("connected", function(){
		isBrowserConnected = true;
	});

	// Kill browsers that don't reconnect
	var killTime = new Date().getTime() + this.reconnectionTimeout;
	(function killIfNoReconnect(){
		var now;

		if(isBrowserConnected){ // Has browser reconnected?
			return;
		}

		now = new Date().getTime();

		if(now < killTime){
			process.nextTick(killIfNoReconnect)
		} else {
			self._browserDisconnectHandler(browser);
		}
	}());
};