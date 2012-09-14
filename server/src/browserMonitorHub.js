var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var uuid = require('node-uuid');

var createLogger = require("./logger.js").create;

exports.create = create = function(socketServer){
	var emitter = new EventEmitter();
	var logger = createLogger();
	var browserMonitorHub = new BrowserMonitorHub(socketServer, logger);
	logger.prefix = "BrowserMonitorHub-" + browserMonitorHub.getId().substr(0,4);
	logger.trace("Created");

	return browserMonitorHub;
};

exports.BrowserMonitorHub = BrowserMonitorHub = function(emitter, logger){
	var self = this;

	if(emitter === void 0){
		throw "BrowserMonitorHub must be started with an emitter";
	}


	if(logger === void 0){
		throw "BrowserMonitorHub must be started with an logger";
	}

	this._id = uuid.v4();
	this._browsers = {};
	this._emitter = void 0;
	this._logger = logger;
	
	this._newListenerHandler = _.bind(this._newListenerHandler, this);
	this._browserSpawnedWorkerHandler = _.bind(this._browserSpawnedWorkerHandler, this);
	this._browserReleasedWorkerHandler = _.bind(this._browserReleasedWorkerHandler, this);
	this._browserMessageToWorkerHandler = _.bind(this._browserMessageToWorkerHandler, this);
	this._browserMessageFromWorkerHandler = _.bind(this._browserMessageFromWorkerHandler, this);

	this.setEmitter(emitter);
};

BrowserMonitorHub.prototype.getId = function(emitter){
	return this._id;
}

BrowserMonitorHub.prototype.setEmitter = function(emitter){
	if(this._emitter !== void 0){
		this._emitter.removeListener("connection", this._newListenerHandler);	
	}

	this._emitter = emitter;
	if(this._emitter !== void 0){
		emitter.on("connection", this._newListenerHandler);	
	}
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
		this._emitter.emit("browserConnected", browser.getAttributes());
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
		this._emitter.emit("browserDisconnected", browser.getAttributes());
	}
};

BrowserMonitorHub.prototype._browserSpawnedWorkerHandler = function(data){
	this._emitter.emit("browserUpdate", "worker spawned");
};

BrowserMonitorHub.prototype._browserReleasedWorkerHandler = function(data){
	this._emitter.emit("browserUpdate", "worker released");
};

BrowserMonitorHub.prototype._browserMessageToWorkerHandler = function(data){
	this._emitter.emit("browserUpdate", "message to worker");
};

BrowserMonitorHub.prototype._browserMessageFromWorkerHandler = function(data){
	this._emitter.emit("browserUpdate", "message from worker");
};

BrowserMonitorHub.prototype._newListenerHandler = function(emitter){
	var browsers = _.map(this._browsers, function(browser){
		return browser.getAttributes();
	});

	this._logger.debug("New connection accepted.");
	this._emitter.emit('browserList', browsers);
}