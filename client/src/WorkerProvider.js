var WorkerProvider = exports.WorkerProvider = function(env, client){
	this._client = client;
	this._workerCount = 0;
	this._workerSockets = {};
	this._emitter = new EventEmitter();
	
	_.bindAll(this, "getSocket", 
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
		logger = options.logger,
		client = options.client || Client.create({socketPath: options.socketPath, socket:options.socket, logger: logger});
		workerProvider = new WorkerProvider(env, client);
	
	if(logger !== void 0){
		workerProvider.setLogger(logger);
	}

	return workerProvider;
};

WorkerProvider.prototype.maxWorkerSocketCount = 10;

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

WorkerProvider.prototype._spawnWorker = function(data){
	var self = this,
		socketId = data.id,
		workerContext = data.context,
		worker;

	if(this._workerCount > this.maxWorkerSocketCount){
		return;
	}

	this._workerCount += 1;
	if(this._workerCount === this.maxWorkerSocketCount){
		this._echo("unavailable");
	}

	workerSocket = WorkerSocket.create(socketId, {logger: this._logger});
	workerSocket.on("emit", function(event, data){
		self._emitFromWorker(socketId, event, data);	
	});
	workerSocket.on("done", function(){
		self._workerDoneHandler(socketId);
	});

	this._workerSockets[socketId] = workerSocket;

	this._echo("workerSpawned");
	
	workerSocket.setContext(workerContext);

	return workerSocket;
};

WorkerProvider.prototype._killHandler = function(){
	this.kill();
}

WorkerProvider.prototype._resetHandler = function(){
	this._destroyWorkers();
};

WorkerProvider.prototype._destroyWorkers = function(){
	_.each(this._workerSockets, function(socket){
		socket.echo("kill");
	});

	this._workerSockets = {};
	this._pendingFromWorkers = [];
};

WorkerProvider.prototype._emit = function(event, data){
	this._browser.emit(event, data);
};

WorkerProvider.prototype._emitFromWorker = function(socketId, event, data){
	var data = {
		id: socketId,
		event: event,
		data: data
	}
	
	this._emit("bullhorn:fromWorker", data);
};

WorkerProvider.prototype._workerDoneHandler = function(socketId){
	var worker = this._workerSockets[socketId]
	if(worker !== void 0){
		delete this._workerSockets[socketId];
		this._workerCount -= 1;
		this._echo("workerDone");
		if(this._workerCount === (this.maxWorkerSocketCount - 1)){
			this._echo("available");
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
		this._echo("killingStaleSocket");
		this._emitFromWorker(socketId, "done");
		return;
	};

	workerSocket.echo(event, eventData);
};

// Events
WorkerProvider.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

WorkerProvider.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkerProvider.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

WorkerProvider.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

// Logging
WorkerProvider.prototype.eventsToLog = [
	["info", "browserConnected", "Browser connected"],
	["info", "browserDisconnected", "Browser disconnected"],
	["info", "workerSpawned", "Worker spawned"],
	["info", "workerDone", "Worker done, disconnected worker socket"],
	["warn", "killingStaleSocket", "Worker socket no longer exists, sending kill command to worker"],
	["warn", "unavailable", "Worker socket limit reached"],
	["info", "available", "Available to spawn workers"]
];

WorkerProvider.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[Bullhorn] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};