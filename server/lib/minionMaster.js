var socketio = require("socket.io"),
	http = require('http'),
	EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	uuid = require('node-uuid');

var createBrowserHub = require('./browserHub.js').create,
	createBrowserProvider = require('./browser_providers/selenium.js').create,
	createStaticServer = require('./staticServer.js').create;

exports.create = create = function(options){
	var options = options || {},
		emitter = options.emitter || new EventEmitter(),
		logger = options.logger,
		port = options.port || 80,
		hostName = options.hostName || "localhost",
		browserCapturePath = options.browserCapturePath || "/capture",
		captureUrl = options.captureUrl || "http://" + hostName + ":" + port + browserCapturePath + ".html",
		httpServer = options.httpServer || createStaticServer({port: port, captureUrl: captureUrl, gridHost: gridHost}),
		gridHost = options.gridHost || "localhost",
		socketServer = options.socketServer || socketio.listen(httpServer, {log: false}),
		browserHub = options.browserHub || createBrowserHub(socketServer.of(browserCapturePath), {logger: logger}),
		browserProvider = options.browserProvider || createBrowserProvider({captureUrl: captureUrl}),
		
	minionMaster = new MinionMaster(emitter, browserHub, browserProvider);

	if(options.populateWith){
		options.populateWith.forEach(function(browserCapabilities){
			minionMaster.spawnBrowser(browserCapabilities);
		});
	}

	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(emitter, browserHub, browserProvider){
	var self = this;

	this._browserHub = browserHub;
	this._browserProvider = browserProvider;
	this._emitter = emitter;

	this._browserHub.on("browserConnected", function(client){
		self._emit("clientConnected", client);
	});

	this._browserHub.on("browserDisconnected", function(client){
		self._emit("clientDisconnected", client);
	});
};

MinionMaster.prototype.spawnBrowser = function(browserCapabilities, callback){
	var self = this,
		minionId = uuid.v4();

	function idMatcher(browser){
		if(browser.getId() === minionId){
			self._browserHub.removeListener("browserConnected", idMatcher);
			if(_.isFunction(callback)){
				callback(browser);	
			}
		}
	};
	this._browserHub.on("browserConnected", idMatcher);
	
	this._browserProvider.createBrowser(minionId, browserCapabilities);

	return minionId;
};

MinionMaster.prototype.killBrowser = function(driver, callback){
	return this._browserProvider.killBrowser(driver, callback);
};

MinionMaster.prototype.kill = function(callback){
	this._browserHub.kill();
	this._browserProvider.kill(callback);
};

// EVENT HANDLERS
MinionMaster.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

MinionMaster.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

MinionMaster.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

MinionMaster.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

