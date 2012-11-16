var socketio = require("socket.io"),
	http = require('http'),
	EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	uuid = require('node-uuid');

var createClientHub = require('./clientHub.js').create,
	createStaticServer = require('./staticServer.js').create,
	createWorkforce = require('./workforce.js').create,
	createWorkerProvider = require('./workerProvider.js').create;

exports.create = create = function(options){
	var options = options || {},
		logger = options.logger,
		port = options.port || 80,
		hostName = options.hostName || "localhost",
		browserCapturePath = options.browserCapturePath || "/capture",
		captureUrl = options.captureUrl || "http://" + hostName + ":" + port + browserCapturePath + ".html",
		httpServer = options.httpServer || createStaticServer({port: port, captureUrl: captureUrl}),
		socketServer = options.socketServer || socketio.listen(httpServer, {log: false}),
		clientHub = options.clientHub || createClientHub(socketServer.of(browserCapturePath), {logger: logger}),
		minionMaster = new MinionMaster(clientHub);
	
	if(options.logger){
		minionMaster.setLogger(options.logger);
	}
	
	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(clientHub){
	var self = this;

	this._emitter = new EventEmitter();
	this._clientHub = clientHub;
	this._workerProviders = {};
	this._workforces = [];
	
	_.bindAll(this, "_clientConnectedHandler",
					"_clientDisconnectedHandler");

	this._clientHub.on("clientConnected", this._clientConnectedHandler);
	this._clientHub.on("clientDisconnected", this._clientDisconnectedHandler);
};

MinionMaster.prototype._clientConnectedHandler = function(client){
	var workerProvider = createWorkerProvider(client, {logger: this._logger}),
		clientId = client.getId();
	
	this._workerProviders[clientId] = workerProvider;
	this._emit("workerProviderConnected", workerProvider);
};

MinionMaster.prototype._clientDisconnectedHandler = function(client){
	var clientId = client.getId();
	var workerProvider = this._workerProviders[clientId];
	if(workerProvider !== void 0){
		delete this._workerProviders[clientId];
		this._emit("workerProviderDisconnected", workerProvider);
	}
};

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


// WORKFORCE FACTORIES
MinionMaster.prototype.createWorkforce = function(context, options){
	var self = this,
		options = options || {},
		workerFilters = options.workerFilters,
		workerProviders = this.getWorkerProviders(workerFilters);

	options.logger = options.logger || this._logger;

	var workforce = createWorkforce(workerProviders, context, options);
	
	this._workforces.push(workforce);

	workforce.on("dead", function(){
		self.removeWorkforce(workforce);
	});

	this._emit("workforceCreated", workforce);

	if(options.autostart) workforce.start();
	return workforce;
};

MinionMaster.prototype.removeWorkforce = function(workforce){
	var index = _.indexOf(this._workforces, workforce);

	if(index > -1){
		this._workforces.splice(index, 1);
	}
};

MinionMaster.prototype.killWorkforces = function(){
	this._workforces.forEach(function(workforce){
		workforce.kill();
	});
};

MinionMaster.prototype.kill = function(callback){
	// All workProviders have the clientHub as origin, so they'll be
	// killed with this action also
	this._clientHub.kill();

	this.killWorkforces();
	this._emit("dead");
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

// Logging
MinionMaster.prototype.eventsToLog = [
	["info", "workerProviderConnected", "Workforce created"]
];

MinionMaster.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}

	var prefix = "[MinionMaster] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};
