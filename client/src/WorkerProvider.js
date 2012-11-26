var WorkerProvider = exports.WorkerProvider = function(env, socket, workerFactory){
	precondition.checkDefined(socket, "Client requires a socket");
	
	this._emitter = new EventEmitter();
	this._workerCount = 0;
	this._workers = {};
	this._workerFactory = workerFactory;

	_.bindAll(this,	"_connectHandler",
					"_disconnectHandler",
					"_spawnWorkerHandler", 
					"_workerEventHandler",
					"getWorkerSocket");

	env.GetWorkerSocket = this.getWorkerSocket;
	
	this._socket = socket;
	this._socket.on("spawnWorker", this._spawnWorkerHandler);
	this._socket.on("toWorker", this._workerEventHandler);	
	this._socket.on("connect", this._connectHandler); // work around for bug in socket.io
	this._socket.on("disconnect", this._disconnectHandler);
}; 

WorkerProvider.prototype._defaultTimeout = 1000 * 60 * 2; // 2 minutes
WorkerProvider.prototype.getDefaultTimeout = function(){ return this._defaultTimeout;};
WorkerProvider.prototype.setDefaultTimeout = function(defaultTimeout){
	this._defaultTimeout = defaultTimeout;
};

WorkerProvider.prototype._maxTimeout = 1000 * 60 * 10; // 10 minutes
WorkerProvider.prototype.getMaxTimeout = function(){ return this._maxTimeout;};
WorkerProvider.prototype.setMaxTimeout = function(maxTimeout){
	this._maxTimeout = maxTimeout;
};

WorkerProvider.create = function(options){
	var options = options || {},
		env = options.env || window,
		maxTimeout = options.maxTimeout,
		defaultTimeout = options.defaultTimeout,
		workerFactory = options.workerFactory || IframeWorker.create,
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath, {
			'max reconnection attempts': Infinity
		}),
		workerProvider = new WorkerProvider(env, socket, workerFactory);

	if(options.logger){
		workerProvider.setLogger(options.logger);
	}

	if(maxTimeout){
		workerProvider.setMaxTimeout(maxTimeout);
	}

	if(defaultTimeout){
		workerProvider.setDefaultTimeout(defaultTimeout);
	}

	return workerProvider;
};

WorkerProvider.prototype._reload = function(){
	window.location.reload(true);
};

WorkerProvider.prototype.kill = function(){
	this._destroyWorkers();

	this._socket.removeListener("connect", this._connectHandler);
	this._socket.removeListener("disconnect", this._disconnectHandler);
	this._socket.removeListener("spawnWorker", this._spawnWorkerHandler);
	this._socket.removeListener("toWorker", this._workerEventHandler);	

	this._socket = void 0;

	this._trigger('dead');
};

// Iframes call this to get their work emission object
WorkerProvider.prototype.getWorkerSocket = function(socketId){
	return this._workers[socketId];
};

WorkerProvider.prototype._destroyWorkers = function(){
	_.each(this._workers, function(worker){
		worker.trigger("kill");
	});

	this._workers = {};	
	this._workerCount = 0;
};

WorkerProvider.prototype._spawnWorkerHandler = function(data){
	var self = this,
		socketId = data.id,
		workerConfig = data.workerConfig,
		timeout = data.timeout || this._defaultTimeout,
		worker,
		workerTimeout;

	if(this._workerCount > this.maxWorkerSocketCount){
		return;
	}

	if(timeout > this._maxTimeout){
		timeout = this._maxTimeout;	
	}
	
	this._workerCount += 1;
	if(this._workerCount === this.maxWorkerSocketCount){
		this._trigger("unavailable");
	}

	worker = this._workerFactory(socketId, {logger: this._logger});

	worker.on("emit", function(event, data){
		self._emitWorkerEvent(socketId, event, data);	
	});

	workerTimeout = setTimeout(function(){
		worker.kill();
	}, timeout);
	
	worker.on("dead", function(){
		clearTimeout(workerTimeout);
		self._workerDeadHandler(socketId);
	});

	this._workers[socketId] = worker;

	this._trigger("workerSpawned");
	
	worker.start(workerConfig);

	return worker;
};

WorkerProvider.prototype._emitWorkerEvent = function(socketId, event, data){
	var data = {
		id: socketId,
		event: event,
		data: data
	}

	this._emit("workerEvent", data);
};

WorkerProvider.prototype._workerDeadHandler = function(socketId){
	var worker = this._workers[socketId];

	if(worker !== void 0){
		delete this._workers[socketId];
	
		this._workerCount -= 1;
		this._trigger("workerDead");
	
		if(this._workerCount === (this.maxWorkerSocketCount - 1)){
			this._trigger("available");
		}
	}
};

// Routes commands to workers
WorkerProvider.prototype._workerEventHandler = function(data){
	var socketId = data.id,
		event = data.event,
		eventData = data.data;

	var workerSocket = this._workers[socketId];
	if(workerSocket === void 0){ // No longer listening to this worker
		if(event !== "kill"){
			this._trigger("killingStaleSocket");
			this._emitFromWorker(socketId, "kill");
		}

		return;
	};

	workerSocket.trigger(event, eventData);
};

WorkerProvider.prototype._register = function(){
	var attributes = {},
		capabilities = {};

	attributes.userAgent = navigator.userAgent;

	// fill up capabilities
	_.each(Modernizr, function(value, key){
		if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
			capabilities[key] = value;
		}
	});

	attributes.capabilities = capabilities;
	this._emit("register", attributes);
	this._trigger('registered');
};

WorkerProvider.prototype._emit = function(event, data){
	this._socket.emit(event, data);	
};

// CONNECTION HANDLERS
WorkerProvider.prototype._connectHandler = function(){
	if(this._isReconnecting){
		this._reload(); // Reload on reconnect
	} else {
		this._register();
		this._trigger("connected");
	}
};

WorkerProvider.prototype._trigger = function() {
	this._emitter.trigger.apply(this._emitter, arguments);
};

WorkerProvider.prototype._disconnectHandler = function(){
	this._destroyWorkers();
	this._trigger("disconnected");
	this._isReconnecting = true;
};

WorkerProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkerProvider.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};


// Logging
WorkerProvider.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["info", "disconnected", "Disconnected"],
	["info", "reconnect", "Reconnected"],
	["info", "registered", "Registered"],
	["debug", "reset", "Reset"],
	["debug", "dead", "Dead"]
];

WorkerProvider.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[WorkerProvider] ";
	
	if(this._logger !== void 0){
		Utils.stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = Utils.logEvents(logger, this, prefix, this.eventsToLog);
	};
};