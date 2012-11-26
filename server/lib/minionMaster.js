var _ = require("underscore"),
	socketio = require("socket.io"),
	http = require('http'),
	EventEmitter = require("events").EventEmitter,
	uuid = require('node-uuid'),
	net = require('net'),
	precondition = require('precondition');

var createWorkerProvider = require("./browserWorkerProvider.js").create,
	createStaticServer = require('./staticServer.js').create,
	createWorkforce = require('./workforce.js').create,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

/** Factory function for MinionMaster instances
* 
*	@param {Object} socketServer A socket server to monitor connections on
*	@param {Object} [options] A map of optional construction parameters
*	@param {Object} [options.logger] A logger to output logging to
*	@param {Number} [options.registerationTimeout] Timeout to determine how long
						to wait for a connection to register before closing it
*/
exports.create = function(options){
	var options = options || {},
		logger = options.logger,
		port = options.port || 80,
		hostname = options.hostname || "localhost",
		browserCapturePath = options.browserCapturePath || "/capture",
		httpServer = options.httpServer ||  createStaticServer({port: port, hostname: hostname}),
		socketServer = options.socketServer || socketio.listen(httpServer, {log: false}),
		minionMaster = new MinionMaster(socketServer.of(browserCapturePath));

	// If logger exists, attach to it
	if(options.logger){
		minionMaster.setLogger(options.logger);
	}
	
	if(options.registerationTimeout){
		minionMaster.registerationTimeout = options.registerationTimeout;
	}

	return minionMaster;
};

/** MinionMaster keeps track of connected worker providers
*
* @constructor
* @param socketServer The socketServer server to which worker providers establish connection with
*/
var MinionMaster = exports.MinionMaster = function(socketServer, controlServer){
	precondition.checkDefined(socketServer, "MinionMaster requires a socket server");

	this._emitter = new EventEmitter();
	this._workerProviders = {};
	this._workforces = [];
	this._server = socketServer;
	this._controlServer = controlServer;

	_.bindAll(this, "_connectionHandler");
	this._server.on("connection", this._connectionHandler);
};


/** @default */
MinionMaster.prototype.registerationTimeout = 2000;


/** Given a list of filters, returns all matching providers in the worker provider
* 	pool. Filters are maps of desired attributes.
*
* 	@param {Array<Object>} filters The attributes to match against
*
* 	@returns {Array<WorkerProvider>} The matching workerProviders
*/
MinionMaster.prototype.getWorkerProviders = function(filters){
	if(!filters){
		return _.values(this._workerProviders);
	}

	if(!_.isArray(filters)){
		filters = [filters];
	}

	var workerProviders = _.filter(this._workerProviders, function(workerProvider){
		return _.any(filters, function(filter){
			return workerProvider.hasAttributes(filter);
		});
	});

	return workerProviders;
};


// Workforce factory
MinionMaster.prototype.getWorkforce = function(workerFilters){
	var self = this,
		workforce = createWorkforce({logger: this._logger});
	
	this._workforces.push(workforce);
	workforce.on("dead", function(){
		self._removeWorkforce(workforce);
	});

	workforce.on("start", function(config){
		self._populateWorkforce(workforce, workerFilters, config);
	});

	this._emit("workforceCreated", workforce);

	return workforce;
};

MinionMaster.prototype._populateWorkforce = function(workforce, workerFilters, config){
	var workerProviders = this.getWorkerProviders(workerFilters);
	workerProviders.forEach(function(workerProvider){
		var worker = workerProvider.spawnWorker(config.workerConfig, config.timeout);
	
		if(worker === void 0) return; //worker provider unavailable

		workforce.addWorker(worker);
	});
}

MinionMaster.prototype._removeWorkforce = function(workforce){
	var index = _.indexOf(this._workforces, workforce);

	if(index > -1){
		this._workforces.splice(index, 1);
	}
};

/**	Kills this instance
*
* 	@fires MinionMaster#dead
*/
MinionMaster.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;
	
	_.each(this._workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	this._workerProviders = {};
	
	this._server.removeListener("connection", this._connectionHandler);
	
	/**
	* Signals that this object should no longer be used
	* 
	* @event MinionMaster#dead
	*/
	this._emit("dead");
	this._emitter.removeAllListeners();
};


// EVENT HANDLERS
MinionMaster.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

MinionMaster.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

MinionMaster.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

/** Attach a worker provider instance to the hub
*
*	@private
*	@param {WorkerProvider} workerProvider A worker provider instance to attach
*   @fires MinionMaster#workerProviderConnected
*/
MinionMaster.prototype._attachWorkerProvider = function(workerProvider){
	workerProviderId = workerProvider.getId();
	this._workerProviders[workerProviderId] = workerProvider;

	/**
	*	@event MinionMaster#workerProviderConnected
	*	@property {WorkerProvider} The worker provider instance that has connected
	*/
	this._emit("workerProviderConnected", workerProvider);
};

/** Detach a worker provider instance from the hub
*
*	@private
*	@param {WorkerProvider} workerProvider The worker provider instance to detach
*	@fires MinionMaster#workerProviderDisconnected
*/
MinionMaster.prototype._detachWorkerProvider = function(workerProvider){
	var workerProviderId = workerProvider.getId();

	if(this._workerProviders[workerProviderId] !== void 0){
		workerProvider.kill();

		delete this._workerProviders[workerProviderId];

		/**
		*	@event MinionMaster#workerProviderDisconnected
		*	@property {WorkerProvider} The worker provider instance that has connected
		*/
		this._emit("workerProviderDisconnected", workerProvider);
	}
};

/** Handles new connections on the socket server
*
*	@private
*	@param {Socket} socket The socket that has just connected
*	@fires MinionMaster#socketConnected
*	@fires MinionMaster#socketDisconnected
*/
MinionMaster.prototype._connectionHandler = function(socket){
	var self = this;
	
	/**
	*	@event MinionMaster#socketConnected
	*	@property {Socket} The socket that has connected
	*/
	self._emit("socketConnected", socket);

	var registerationTimeout = setTimeout(function(){
		self._emit('socketTimeout', socket);
		socket.disconnect();
	}, this.registerationTimeout);
	
	socket.on("register", function(registerationData){
		var workerProvider;

		clearTimeout(registerationTimeout);
		
		workerProvider = createWorkerProvider(socket, {attributes: registerationData, logger: self._logger});
		self._attachWorkerProvider(workerProvider);
		
		socket.on("disconnect", function(){

			/**
			*	@event MinionMaster#socketDisconnected
			*	@property {Socket} The socket that has disconnected
			*/
			self._detachWorkerProvider(workerProvider);
		});
	});

	socket.on('disconnect', function(){
		self._emit("socketDisconnected");
	});
};

// Optional logging helpers
MinionMaster.prototype.eventsToLog = [
	["info", "socketConnected", "Socket connected"],
	["debug", "socketTimeout", "Socket didn't register in time (timed out)"],
	["info", "socketDisconnected", "Socket disconnected"],
	["info", "workerProviderConnected", "Worker Provider connected"],
	["info", "workerProviderDisconnected", "Worker provider disconnected"]
];

MinionMaster.prototype.setLogger = function(logger){
	var prefix = "[MinionMaster] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};