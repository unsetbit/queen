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
		this._workerSockets = {};
		this._logger = createLogger({prefix: "Browser"});
		this._available = true;
		
		this._errorHandler = _.bind(this._errorHandler, this);
		this._connectHandler = _.bind(this._connectHandler, this);
		this._disconnectHandler = _.bind(this._disconnectHandler, this);
		this._reconnectHandler = _.bind(this._reconnectHandler, this);
		this._reconnectFailHandler = _.bind(this._reconnectFailHandler, this);
		this._workerEventHandler = _.bind(this._workerEventHandler, this);
		this._reset = _.bind(this._reset, this);
		this.kill = _.bind(this.kill, this);
		this.spawnWorker = _.bind(this.spawnWorker, this);

		this.setSocket(socket);
		this._logger.trace("Created");
	};

	Browser.prototype.setSocket = function(socket){
		if(this._socket !== void 0){
			this._socket.removeListener("error", this._errorHandler);
			this._socket.removeListener("connect", this._connectHandler);
			this._socket.removeListener("disconnect", this._disconnectHandler);
			this._socket.removeListener("reconnect", this._reconnectHandler);
			this._socket.removeListener("reconnect_failed", this._reconnectFailHandler);
			this._socket.removeListener("reset", this._reset);
			this._socket.removeListener("kill", this.kill);
			this._socket.removeListener("spawnWorker", this.spawnWorker);
			this._socket.removeListener("toWorker", this._workerEventHandler);		
			this._logger.debug("Detached socket");
		}

		this._socket = socket;

		if(this._socket !== void 0){
			this._socket.on("error", this._errorHandler);
			this._socket.on("connect", this._connectHandler);
			this._socket.on("disconnect", this._disconnectHandler);
			this._socket.on("reconnect", this._reconnectHandler);
			this._socket.on("reconnect_failed", this._reconnectFailHandler);
			this._socket.on("reset", this._reset);
			this._socket.on("kill", this.kill);
			this._socket.on("spawnWorker", this.spawnWorker);
			this._socket.on("toWorker", this._workerEventHandler);	
			this._logger.debug("Attached to socket");	
		}
	};

	Browser.prototype._connectHandler = function(){
		this._connected = true;
		this._socket.emit("register", this.getAttributes());
		this._logger.debug("Connected");
	};

	Browser.prototype._reconnectHandler = function(){
		this._connected = true;
		this._logger.debug("Reconnected");
	};

	Browser.prototype._disconnectHandler = function(){
		this._connected = false;
		this._logger.debug("Disconnected");
	};

	Browser.prototype._reconnectFailHandler = function(){
		this._connected = true;
		this._logger.debug("Reconnect Failed");
	};

	Browser.prototype.kill = function(){
		this.setSocket(void 0);
		this._logger.debug("Dead");
	};

	Browser.prototype._reset = function(data){
		this._id = data.id;
		this._destroyWorkers();
		this._logger.debug("Resetting");
	};

	Browser.prototype._destroyWorkers = function(){
		_.each(this.workerSockets, function(socket){
			socket.destroy();
		});

		this._workerSockets = {};
	};

	Browser.prototype.defaultAttributes = {
		availableOnRegister: true
	};

	Browser.prototype.getAttributes = function(){
		var attributes = extend({}, this.defaultAttributes, {
			id : this._id
		});

		_.each(Modernizr, function(value, key){
			if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
				attributes[key] = value;
			}
		});
		return attributes;
	};

	Browser.prototype.spawnWorker = function(data){
		var self = this,
			socketId = data.id,
			workerData = data.data,
			worker;

		workerSocket = createWorkerSocket(socketId, data);
		this._logger.debug("Spawned worker socket");

		this._connectWorkerSocket(workerSocket);

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

	Browser.prototype._connectWorkerSocket = function(workerSocket){
		var self = this,
			socketId = workerSocket.getId();

		this._workerSockets[socketId] = workerSocket;
		
		workerSocket.setEmitHandler(function(event, data){
			var data = {
				id: socketId,
				event: event,
				data: data
			}

			self._socket.emit("fromWorker", data);
		});

		workerSocket.on("done", function(){
			self._disconnectWorker(socketId);
		});
		this._logger.debug("Connected worker socket");
	};

	Browser.prototype._disconnectWorker = function(socketId){
		delete this._workerSockets[socketId];
		this._logger.debug("Disconnected worker socket");
	};

	// Routes commands to workers
	Browser.prototype._workerEventHandler = function(data){
		var socketId = data.id,
			event = data.event,
			data = data.data;
		
		var workerSocket = this._workerSockets[socketId];
		workerSocket.echo(event, data);
	};

	return exports;
});