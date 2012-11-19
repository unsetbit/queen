var WorkerProvider = exports.WorkerProvider = function(env, client, workerFactory){
	this._client = client;
	this._workerCount = 0;
	this._workerSockets = {};
	this._workerFactory = workerFactory;
	this._emitter = new EventEmitter();
	
	_.bindAll(this, "getWorkerSocket", 
					"_killHandler", 
					"_resetHandler", 
					"_spawnWorker", 
					"_workerEventHandler", 
					"_destroyWorkers");
	
	env.GetWorkerSocket = this.getWorkerSocket;

	this._client.on("workerProvider:spawnWorker", this._spawnWorker);
	this._client.on("workerProvider:toWorker", this._workerEventHandler);	
	this._client.on("dead", this._killHandler);
	this._client.on("reset", this._resetHandler);	
};

WorkerProvider.create = function(options){
	var options = options || {},
		env = options.env || window,
		maxTimeout = options.maxTimeout,
		defaultTimeout = options.defaultTimeout,
		workerFactory = options.workerFactory || IframeWorker.create,
		client = options.client || BrowserClient.create({socketPath: options.socketPath, socket:options.socket, logger: options.logger});
		workerProvider = new WorkerProvider(env, client, workerFactory);
	
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

WorkerProvider.prototype.maxWorkerSocketCount = 100;

// Iframes call this to get their work emission object
WorkerProvider.prototype.getWorkerSocket = function(socketId){
	var workerSocket = this._workerSockets[socketId];
	return workerSocket;
};

WorkerProvider.prototype.kill = function(){
	this._client.removeListener("workerProvider:spawnWorker", this._spawnWorker);
	this._client.removeListener("workerProvider:toWorker", this._workerEventHandler);	
	this._client.removeListener("dead", this._killHandler);
	this._client.removeListener("reset", this._resetHandler);
	this._client = void 0;

	this._destroyWorkers();
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

WorkerProvider.prototype._spawnWorker = function(data){
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
		self._emitFromWorker(socketId, event, data);	
	});

	workerTimeout = setTimeout(function(){
		worker.kill();
	}, timeout);
	
	worker.on("dead", function(){
		clearTimeout(workerTimeout);
		self._workerDeadHandler(socketId);
	});

	this._workerSockets[socketId] = worker;

	this._trigger("workerSpawned");
	
	worker.start(workerConfig);

	return worker;
};

WorkerProvider.prototype._killHandler = function(){
	this.kill();
}

WorkerProvider.prototype._resetHandler = function(){
	this._destroyWorkers();
};

WorkerProvider.prototype._destroyWorkers = function(){
	_.each(this._workerSockets, function(socket){
		socket.trigger("kill");
	});

	this._workerSockets = {};
	this._pendingFromWorkers = [];
};

WorkerProvider.prototype._emit = function(event, data){
	this._client.emit(event, data);
};

WorkerProvider.prototype._emitFromWorker = function(socketId, event, data){
	var data = {
		id: socketId,
		event: event,
		data: data
	}

	this._emit("workerProvider:fromWorker", data);
};

WorkerProvider.prototype._workerDeadHandler = function(socketId){
	var worker = this._workerSockets[socketId];

	if(worker !== void 0){
		delete this._workerSockets[socketId];
	
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

	var workerSocket = this._workerSockets[socketId];
	if(workerSocket === void 0){ // No longer listening to this worker
		if(event !== "kill"){
			this._trigger("killingStaleSocket");
			this._emitFromWorker(socketId, "kill");
		}

		return;
	};

	workerSocket.trigger(event, eventData);
};

// Events
WorkerProvider.prototype._trigger = function(event, data){
	this._emitter.trigger(event, [data]);
};

WorkerProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkerProvider.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

// Logging
WorkerProvider.prototype.eventsToLog = [
	["info", "browserConnected", "Browser connected"],
	["info", "browserDisconnected", "Browser disconnected"],
	["info", "workerSpawned", "Worker spawned"],
	["info", "workerDead", "Worker dead, disconnected worker socket"],
	["warn", "killingStaleSocket", "Worker socket no longer exists, sending kill command to worker"],
	["warn", "unavailable", "Worker socket limit reached"],
	["info", "available", "Available to spawn workers"]
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