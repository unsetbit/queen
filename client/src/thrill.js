define(function(require, exports, module) {
    var createWorkerSocket = require('./workerSocket.js').create;
	var EventEmitter = require('../lib/nodeEvents.js').EventEmitter,
	   	logEvents = require("./utils.js").logEvents,
		stopLoggingEvents = require("./utils.js").stopLoggingEvents;
	
	exports.create = function(browser, options){
		var options = options || {},
			env = options.env || window,
			emitter = options.emitter || new EventEmitter(),
			thrillClient = new ThrillClient(env, browser, emitter);
		
		if(options.logger !== void 0){
			thrillClient.setLogger(options.logger);
		}

		return thrillClient;
	};

	exports.ThrillClient = ThrillClient = function(env, browser, emitter){
		this._browser = void 0;
		this._workerCount = 0;
		this._workerSockets = {};
		this._emitter = emitter;

		this._logger = void 0;
		this._loggingFunctions = void 0;
		
		_.bindAll(this, "getSocket", "_spawnWorker", "_workerEventHandler", "_destroyWorkers");
		
		env.GetThrillSocket = this.getSocket;

		this.setBrowser(browser);
	};

	ThrillClient.prototype.eventsToLog = [
		["info", "browserConnected", "Browser connected"],
		["info", "browserDisconnected", "Browser disconnected"],
		["info", "workerSpawned", "Worker spawned"],
		["info", "workerDone", "Worker done, disconnected worker socket"],
		["warn", "killingStaleSocket", "Worker socket no longer exists, sending kill command to worker"],
		["warn", "unavailable", "Worker socket limit reached"],
		["info", "available", "Available to spawn workers"]
	];

	ThrillClient.prototype.setLogger = function(logger){
		if(this._logger === logger){
			return; // same as existing one
		}
		
		var prefix = "[ThrillClient] ";
		
		if(this._logger !== void 0){
			stopLoggingEvents(this, this._loggingFunctions);
		};

		this._logger = logger;

		if(this._logger !== void 0){
			this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
		};
	};

	ThrillClient.prototype.setBrowser = function(browser){
		if(this._browser !== void 0){
			this._browser.removeListener("thrill:spawnWorker", this._spawnWorker);
			this._browser.removeListener("thrill:toWorker", this._workerEventHandler);	
			this._browser.removeListener("dead", this._destroyWorkers);
			this._browser.removeListener("reset", this._destroyWorkers);
			this._echo("browserDisconnected");	
		}

		this._browser = browser;

		if(this._browser !== void 0){
			this._browser.on("thrill:spawnWorker", this._spawnWorker);
			this._browser.on("thrill:toWorker", this._workerEventHandler);	
			this._browser.on("dead", this._destroyWorkers);
			this._browser.on("reset", this._destroyWorkers);	
			this._echo("browserConnected");
		}
	};

	ThrillClient.prototype._spawnWorker = function(data){
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

		workerSocket = createWorkerSocket(socketId, {logger: this._logger});
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


	ThrillClient.prototype._destroyWorkers = function(){
		_.each(this._workerSockets, function(socket){
			socket.echo("kill");
		});

		this._workerSockets = {};
		this._pendingFromWorkers = [];
	};

	ThrillClient.prototype._emit = function(event, data){
		this._browser.emit(event, data);
	};

	ThrillClient.prototype._emitFromWorker = function(socketId, event, data){
		var data = {
			id: socketId,
			event: event,
			data: data
		}
		
		this._emit("thrill:fromWorker", data);
	};

	ThrillClient.prototype._workerDoneHandler = function(socketId){
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

	ThrillClient.prototype.maxWorkerSocketCount = 10;

	// Iframes call this to get their work emission object
	ThrillClient.prototype.getSocket = function(socketId){
		var workerSocket = this._workerSockets[socketId];
		return workerSocket;
	};

	// Routes commands to workers
	ThrillClient.prototype._workerEventHandler = function(data){
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

	ThrillClient.prototype._echo = function(event, data){
		this._emitter.emit(event, data);
	};

	ThrillClient.prototype.on = function(event, callback){
		this._emitter.on(event, callback);
	};

	ThrillClient.prototype.once = function(event, callback){
		this._emitter.once(event, callback);
	};

	ThrillClient.prototype.removeListener = function(event, callback){
		this._emitter.removeListener(event, callback);
	};

	return exports;
});