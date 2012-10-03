var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	uuid = require('node-uuid');

var createBrowser = require("./browser.js").create,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = function(server, options){
	var options = options || {},
		emitter = options.emitter || new EventEmitter(),
		browserHub = new BrowserHub(server, emitter);

	// If logger exists, attach to it
	if(options.logger){
		browserHub.setLogger(options.logger);
	}
	
	return browserHub;
};

exports.BrowserHub = BrowserHub = function(server, emitter){
	if(server === void 0){
		throw "BrowserHub requires a server";
	}

	if(emitter === void 0){
		throw "BrowserHub requires an emitter";
	}

	this._emitter = emitter;
	this._id = uuid.v4();
	this._browsers = {};
	this._server = server;

	_.bindAll(this, "_connectionHandler");
	this._server.on("connection", this._connectionHandler);
};

// DEFAULT ATTRIBUTES
BrowserHub.prototype.registerationTimeout = 2000;

BrowserHub.prototype.eventsToLog = [
["debug", "socketConnected", "Socket connected"],
	["debug", "socketDisconnected", "Socket disconnected"],
	["info", "clientConnected", "Browser connected"],
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

BrowserHub.prototype.kill = function(){
	_.each(this._browsers, function(browser){
		browser.kill();
	});
	this._browsers = {};
	this._server.removeListener("connection", this._connectionHandler);
	this._emit("dead");
};

BrowserHub.prototype.getId = function(){
	return this._id;
};

// EVENT HANDLERS
BrowserHub.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

BrowserHub.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

BrowserHub.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

BrowserHub.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

BrowserHub.prototype.attachBrowser = function(browser){
	browserId = browser.getId();
	this._browsers[browserId] = browser;

	this._emit("clientConnected", browser);
};

BrowserHub.prototype.detachBrowser = function(browser){
	var browserId = browser.getId();

	if(this._browsers[browserId] !== void 0){
		browser.kill();

		delete this._browsers[browserId];

		this._emit("clientDisconnected", browser);
	}
};

// SOCKET CONNECTION HANDLERS
BrowserHub.prototype._connectionHandler = function(socket){
	var self = this;
	
	self._emit("socketConnected", socket);

	var registerationTimeout = setTimeout(function(){
		socket.disconnect();
		self._emit("socketDisconnected");
	}, this.registerationTimeout);
	
	socket.on("register", function(registerationData){
		var browser;

		clearTimeout(registerationTimeout);
		
		browser = createBrowser(socket, {attributes: registerationData, logger: self._logger});
		self.attachBrowser(browser);

		socket.on("disconnect", function(){
			if(browser.getSocket() === socket){
				self.detachBrowser(browser);
			}
		});
	});
};