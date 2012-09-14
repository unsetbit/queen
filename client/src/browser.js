define(function(require, exports, module) {
    require('/socket.io/socket.io.js');
	var createWorkerSocket = require('/src/workerSocket.js').create;
	var extend = require('/lib/utils.js').extend;
	var createLogger = require('/src/logger.js').create;
	
	exports.create = function(path){
		var socket = io.connect(path, {
			'max reconnection attempts': 10
		});
		var browser = new Browser(socket);
		return browser;
	};

	exports.Browser = Browser = function(socket){
		var self = this;

		this._id = void 0;
		
		this._pendingEmissions = [];
		this._workerCount = 0;

		this._workerSockets = {};
		this._logger = createLogger({prefix: "Browser"});
		
		this._available = true;
		
		this._setIdHandler = _.bind(this._setIdHandler, this);
		this._errorHandler = _.bind(this._errorHandler, this);
		this._spawnWorker = _.bind(this.spawnWorker, this);
		this._workerEventHandler = _.bind(this._workerEventHandler, this);
		this.spawnWorker = _.bind(this.spawnWorker, this);
		this._kill = _.bind(this._kill, this);

		this._connectHandler = _.bind(this._connectHandler, this);
		this._disconnectHandler = _.bind(this._disconnectHandler, this);
		this._reconnectHandler = _.bind(this._reconnectHandler, this);
		this._reconnectedHandler = _.bind(this._reconnectedHandler, this);
		this._reconnectFailHandler = _.bind(this._reconnectFailHandler, this);

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
			this._socket.on("kill", this._kill);
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

	Browser.prototype._kill = function(){
		this._reset();
		this.setSocket(void 0);
		this._logger.debug("Dead");
	};

	Browser.prototype._setIdHandler = function(id){
		this._id = id;
		this.reset();
	};

	Browser.prototype.reset = function(){
		this._destroyWorkers();
		this.__pendingFromWorkers = [];
		this._logger.debug("Reset");
	};

	Browser.prototype._destroyWorkers = function(){
		_.each(this._workerSockets, function(socket){
			socket.kill();
		});

		this._workerSockets = {};
	};

	Browser.prototype.maxWorkerSocketCount = 10;

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

	Browser.prototype.spawnWorker = function(data){
		var self = this,
			socketId = data.id,
			runData = data.initializationData,
			worker;

		if(this._workerCount >= this.maxWorkerSocketCount){
			this._logger.warn("Unable to spawn worker socket because of reached limit (" + this.maxWorkerSocketCount + ")");
			return;
		}

		this._workerCount += 1;

		workerSocket = createWorkerSocket(socketId);
		this._workerSockets[socketId] = workerSocket;
		workerSocket.setEmitHandler(function(event, data){
			self._emitFromWorker(socketId, event, data);	
		});

		workerSocket.on("done", function(){
			self._workerDoneHandler(socketId);
		});
		this._logger.debug("Spawned worker socket");

		workerSocket.run(runData);

		return workerSocket;
	};

	// Iframes call this to get their work emission object
	Browser.prototype.getWorkerSocket = function(socketId){
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

	// Able to connect back to existing session
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
		this._logger.debug("Reconnect failed, killing self");
		this.kill();
	};

	return exports;
});