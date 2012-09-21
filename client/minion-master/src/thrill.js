define(function(require, exports, module) {
    var createWorkerSocket = require('/minion-master/src/workerSocket.js').create;
	var createLogger = require('/minion-master/src/logger.js').create;
	var EventEmitter = require('/minion-master/lib/nodeEvents.js').EventEmitter;
	
	exports.create = function(browser, options){
		var options = options || {},
			env = options.env || window,
			logger = options.logger || createLogger({prefix: "ThrillClient"}),
			browser = new ThrillClient(env, browser, logger);
		
		return browser;
	};

	exports.ThrillClient = ThrillClient = function(env, browser, logger){
		this._browser = void 0;
		this._workerCount = 0;
		this._workerSockets = {};
		this._logger = logger;
		
		_.bindAll(this, "getSocket", "_spawnWorker", "_workerEventHandler", "_destroyWorkers");
		
		env.GetThrillSocket = this.getSocket;

		this.setBrowser(browser);
	};

	ThrillClient.prototype.setBrowser = function(browser){
		if(this._browser !== void 0){
			this._browser.removeListener("thrill:spawnWorker", this._spawnWorker);
			this._browser.removeListener("thrill:toWorker", this._workerEventHandler);	
			this._browser.removeListener("dead", this._destroyWorkers);
			this._browser.removeListener("reset", this._destroyWorkers);	
		}

		this._browser = browser;

		if(this._browser !== void 0){
			this._browser.on("thrill:spawnWorker", this._spawnWorker);
			this._browser.on("thrill:toWorker", this._workerEventHandler);	
			this._browser.on("dead", this._destroyWorkers);
			this._browser.on("reset", this._destroyWorkers);	
		}
	};

	ThrillClient.prototype._spawnWorker = function(data){
		var self = this,
			socketId = data.id,
			workerContext = data.context,
			worker;

		if(this._workerCount >= this.maxWorkerSocketCount){
			this._logger.warn("Unable to spawn worker socket because of reached limit (" + this.maxWorkerSocketCount + ")");
			return;
		}

		this._workerCount += 1;

		workerSocket = createWorkerSocket(socketId);
		workerSocket.on("emit", function(event, data){
			self._emitFromWorker(socketId, event, data);	
		});
		workerSocket.on("done", function(){
			self._workerDoneHandler(socketId);
		});

		this._workerSockets[socketId] = workerSocket;

		this._logger.debug("Spawned worker socket");

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
			this._logger.debug("Worker done, disconnected worker socket");
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
			this._logger.warn("Worker socket no longer exists, sending kill command to worker. Socket id " + socketId);
			this._emitFromWorker(socketId, "done");
			return;
		};

		workerSocket.echo(event, eventData);
	};
});