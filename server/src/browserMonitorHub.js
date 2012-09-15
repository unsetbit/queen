var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var uuid = require('node-uuid');

var createLogger = require("./logger.js").create;

exports.create = create = function(server, options){
	var options = options || {},
		logger = options.logger || createLogger({prefix: "BrowserMonitorHub"}),
		browserMonitorHub = new BrowserMonitorHub(server, logger);

	return browserMonitorHub;
};

exports.BrowserMonitorHub = BrowserMonitorHub = function(server, logger){
	var self = this;

	if(server === void 0){
		throw "BrowserMonitorHub must be started with an server";
	}


	if(logger === void 0){
		throw "BrowserMonitorHub must be started with an logger";
	}

	this._logger = logger;
	this._id = uuid.v4();
	this._browsers = {};
	
	_.bindAll(this, "_newListenerHandler", 
					"_browserSpawnedWorkerHandler", 
					"_browserReleasedWorkerHandler", 
					"_browserMessageToWorkerHandler", 
					"_browserMessageFromWorkerHandler");

	this.setServer(server);

	logger.trace("Created");
};

BrowserMonitorHub.prototype.getId = function(){
	return this._id;
}

BrowserMonitorHub.prototype.setServer = function(server){
	if(this._server !== void 0){
		this._server.removeListener("connection", this._newListenerHandler);	
	}

	this._server = server;
	if(this._server !== void 0){
		this._server.on("connection", this._newListenerHandler);	
	}
};

BrowserMonitorHub.prototype._newListenerHandler = function(emitter){
	var browsers = _.map(this._browsers, function(browser){
		return browser.getAttributes();
	});

	this._logger.debug("New connection accepted.");
	this._server.emit('browserList', browsers);
};

BrowserMonitorHub.prototype.connectBrowser = function(browser){
	var browserId = browser.getId();

	if(this._browsers[browserId] === void 0){
		this._browsers[browserId] = browser;
		browser.on("spawnedWorker", this._browserSpawnedWorkerHandler);
		browser.on("releasedWorker", this._browserReleasedWorkerHandler);
		browser.on("messageToWorker", this._browserMessageToWorkerHandler);
		browser.on("messageFromWorker", this._browserMessageFromWorkerHandler);
		this._logger.info("Connected browser (BrowserId: " + browserId + ")");
		this._server.emit("browserConnected", browser.getAttributes());
	} else {
		this._logger.warn("Tried to connected and already connected browser (BrowserId: " + browserId + ")");
	}
};

BrowserMonitorHub.prototype.disconnectBrowser = function(browser){
	var browserId = browser.getId();

	if(this._browsers[browserId] === void 0){
		this._logger.warn("Tried to disconnecting browser which isn't connected (BrowserId: " + browserId + ")");
	} else {
		browser.removeListener("spawnedWorker", this._browserSpawnedWorkerHandler);
		browser.removeListener("releasedWorker", this._browserReleasedWorkerHandler);
		browser.removeListener("messageToWorker", this._browserMessageToWorkerHandler);
		browser.removeListener("messageFromWorker", this._browserMessageFromWorkerHandler);
		delete this._browsers[browserId];
		this._logger.info("Disconnected browser (BrowserId: " + browserId + ")");
		this._server.emit("browserDisconnected", browser.getAttributes());
	}
};

BrowserMonitorHub.prototype._browserSpawnedWorkerHandler = function(data){
	this._server.emit("browserUpdate", "worker spawned");
};

BrowserMonitorHub.prototype._browserReleasedWorkerHandler = function(data){
	this._server.emit("browserUpdate", "worker released");
};

BrowserMonitorHub.prototype._browserMessageToWorkerHandler = function(data){
	this._server.emit("browserUpdate", "message to worker");
};

BrowserMonitorHub.prototype._browserMessageFromWorkerHandler = function(data){
	this._server.emit("browserUpdate", "message from worker");
};
