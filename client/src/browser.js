define(function(require, exports, module) {
    require('/socket.io/socket.io.js');
	var createWorker = require('/src/worker.js').create;
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
		this._workers = [];
		this._logger = createLogger({prefix: "Browser"});
		this._available = true;
		
		this._errorHandler = _.bind(this._errorHandler, this);
		this._connectHandler = _.bind(this._connectHandler, this);
		this._disconnectHandler = _.bind(this._disconnectHandler, this);
		this._reconnectHandler = _.bind(this._reconnectHandler, this);
		this._reconnectFailHandler = _.bind(this._reconnectFailHandler, this);
		this._workerCommandHandler = _.bind(this._workerCommandHandler, this);
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
			this._socket.removeListener("workerCommand", this._workerCommandHandler);		
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
			this._socket.on("workerCommand", this._workerCommandHandler);		
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
		_.each(this._workers, function(worker){
			worker.destroy();
		});

		this._workers = {};
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
			workerId = data.id,
			workerData = data.data,
			worker;

		worker = createWorker(workerId, data);
		this._connectWorker(workerId, worker);

		this._logger.debug("Created worker");
		return worker;
	};

	// Iframes call this to get their work emission object
	Browser.prototype.getWorkerSocket = function(workerId){
		var worker = this._workers[workerId];
		return worker.getSocket();
	};

	Browser.prototype._errorHandler = function(data){
		this._logger.error(data);
	};

	Browser.prototype._workerEventHandler = function(workerId, event, data){
		var data = {
			id: workerId,
			event: event,
			data: data
		}
		console.log("WORKER EVENT");
		console.log(data);
		this._socket.emit("workerEvent", data);
	};

	Browser.prototype._connectWorker = function(workerId, worker){
		var self = this;

		this._workers[workerId] = worker;
		
		worker.on("workerEvent", function(event, data){
			self._workerEventHandler(workerId, event, data);
		});

		worker.on("dead", function(){
			self._disconnectWorker(workerId);
		});
		this._logger.debug("Connected worker");
	};

	Browser.prototype._disconnectWorker = function(workerId){
		delete this._workers[workerId];
		this._logger.debug("Disconnected worker");
	};

	// Routes commands to workers
	Browser.prototype._workerCommandHandler = function(data){
		var workerId = data.workerId,
			command = data.command,
			data = data.data;
			
		var worker = this._worker[workerId];
		worker.command(command, data);
	};

	return exports;
});