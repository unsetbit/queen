define(function(require, exports, module) {
    var createWorkerSocket = require('/src/workerSocket.js').create;
	var createLogger = require('/src/logger.js').create;
	
	exports.create = function(socket, options){
		var options = options || {},
			logger = options.logger || createLogger({prefix: "Browser"}),
			browser = new Browser(socket, logger);
		
		return browser;
	};

	exports.Browser = Browser = function(socket, logger){
		var self = this;

		if(socket === void 0){
			throw "Browser requires a socket";
		}

		if(logger === void 0){
			throw "Browser requires a logger";
		}

		this._id = void 0;
		this._pendingEmissions = [];
		this._workerCount = 0;
		this._workerSockets = {};
		this._logger = logger;
		
		_.bindAll(this,	"_connectHandler",
						"_disconnectHandler",
						"_reconnectHandler",
						"_reconnectedHandler",
						"_reconnectFailHandler", 
						"_setIdHandler", 
						"_errorHandler", 
						"_spawnWorker", 
						"_workerEventHandler", 
						"_killHandler");

		this.setSocket(socket);
		this._logger.trace("Created");
	};

	Browser.prototype.setSocket = function(socket){
		if(this._socket !== void 0){
			this._socket.removeListener("connect", this._connectHandler);
			this._socket.removeListener("disconnect", this._disconnectHandler);
			this._socket.removeListener("reconnect", this._reconnectHandler);
			this._socket.removeListener("reconnected", this._reconnectedHandler);
			this._socket.removeListener("reconnect_failed", this._reconnectFailHandler);

			this._socket.removeListener("error", this._errorHandler);
			this._socket.removeListener("kill", this._killHandler);
			this._socket.removeListener("setId", this._setIdHandler);
			this._socket.removeListener("spawnWorker", this._spawnWorker);
			this._socket.removeListener("toWorker", this._workerEventHandler);	
			this._logger.debug("Detached socket");
		}

		this._socket = socket;

		if(this._socket !== void 0){
			this._socket.on("connect", this._connectHandler);
			this._socket.on("disconnect", this._disconnectHandler);
			this._socket.on("reconnect", this._reconnectHandler);
			this._socket.on("reconnected", this._reconnectedHandler);
			this._socket.on("reconnect_failed", this._reconnectFailHandler);

			this._socket.on("error", this._errorHandler);
			this._socket.on("kill", this._killHandler);
			this._socket.on("setId", this._setIdHandler);
			this._socket.on("spawnWorker", this._spawnWorker);
			this._socket.on("toWorker", this._workerEventHandler);	
			this._logger.debug("Attached to socket");	
		}
	};

	Browser.prototype._emit = function(event, data){
		if(this._connected){
			this._socket.emit(event, data);	
		} else {
			this._pendingEmissions.push(event, data);
		}
	};

	Browser.prototype._killHandler = function(){
		this._destroyWorkers();
		this.setSocket(void 0);
		this._logger.debug("Dead");
	};

	Browser.prototype._setIdHandler = function(id){
		this._id = id;
		this._destroyWorkers();
	};

	Browser.prototype._destroyWorkers = function(){
		_.each(this._workerSockets, function(socket){
			socket.echo("kill");
		});

		this._workerSockets = {};
		this._pendingFromWorkers = [];
	};

	Browser.prototype.getAttributes = function(){
		var attributes = {},
			capabilities = {};

		attributes.id = this._id;
		attributes.maxWorkerSocketCount = this.maxWorkerSocketCount;
		attributes.capabilities = capabilities;
		_.each(Modernizr, function(value, key){
			if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
				capabilities[key] = value;
			}
		});
		
		attributes.userAgent = navigator.userAgent;

		return attributes;
	};

	Browser.prototype.maxWorkerSocketCount = 10;

	Browser.prototype._spawnWorker = function(data){
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

	// Iframes call this to get their work emission object
	Browser.prototype.getSocket = function(socketId){
		var workerSocket = this._workerSockets[socketId];
		return workerSocket;
	};

	Browser.prototype._errorHandler = function(data){
		this._logger.error(data);
	};

	Browser.prototype._emitFromWorker = function(socketId, event, data){
		var data = {
			id: socketId,
			event: event,
			data: data
		}
		
		this._emit("fromWorker", data);
	};

	Browser.prototype._workerDoneHandler = function(socketId){
		var worker = this._workerSockets[socketId]
		if(worker !== void 0){
			delete this._workerSockets[socketId];
			this._workerCount -= 1;
			this._logger.debug("Worker done, disconnected worker socket");
		}
	};

	// Routes commands to workers
	Browser.prototype._workerEventHandler = function(data){
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

	// CONNECTION HANDLERS
	Browser.prototype._connectHandler = function(){
		this._connected = true;
		this._socket.emit("register", this.getAttributes());
		this._logger.debug("Connected");
	};

	Browser.prototype._reconnectHandler = function(){
		this._connected = true; // Socket reconnected
	};

	Browser.prototype._disconnectHandler = function(){
		this._connected = false;
		this._logger.debug("Disconnected");
	};

	Browser.prototype._reconnectedHandler = function(){
		var pendingEmissions = this._pendingEmissions.slice(0),
			pendingEmission = pendingEmissions.splice(0, 2);

		this._pendingEmissions = [];

		while(pendingEmission.length === 2){
			this._emit(pendingEmission[0], pendingEmission[1]);
			pendingEmission = pendingEmissions.splice(0, 2)
		}

		this._logger.debug("Reconnected"); 
	};

	Browser.prototype._reconnectFailHandler = function(){
		this._logger.debug("Reconnect failed, committing suicide");
		this._kill();
	};

	return exports;
});