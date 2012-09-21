define(function(require, exports, module) {
    var createWorkerSocket = require('/minion-master/src/workerSocket.js').create;
	var extend = require('/minion-master/lib/utils.js').extend;
	var createLogger = require('/minion-master/src/logger.js').create;
	
	exports.create = function(path){
		var socket = io.connect(path);
		var logger = createLogger({prefix: "Browser"});

		var monitor = new Monitor(socket, logger);
		return monitor;
	};

	exports.Monitor = Monitor = function(socket, logger){
		var self = this;

		if(socket === void 0){
			throw "Monitor requires a socket";
		}

		if(logger === void 0){
			throw "Monitor requires a logger";
		}

		this._logger = logger;
		
		this._browserListHandler = _.bind(this._browserListHandler, this);
		this._browserConnectedHandler = _.bind(this._browserConnectedHandler, this);
		this._browserUpdateHandler = _.bind(this._browserUpdateHandler, this);
		this._browserDisconnectedHandler = _.bind(this._browserDisconnectedHandler, this);

		this.setSocket(socket);
		this._logger.trace("Created");
	};

	Monitor.prototype.setSocket = function(socket){
		if(this._socket !== void 0){
			this._socket.removeListener("browserList", this._browserListHandler);
			this._socket.removeListener("browserConnected", this._browserConnectedHandler);
			this._socket.removeListener("browserUpdate", this._browserUpdateHandler);
			this._socket.removeListener("browserDisconnected", this._browserDisconnectedHandler);
			this._logger.debug("Detached socket");
		}

		this._socket = socket;

		if(this._socket !== void 0){
			this._socket.on("browserList", this._browserListHandler);
			this._socket.on("browserConnected", this._browserConnectedHandler);
			this._socket.on("browserUpdate", this._browserUpdateHandler);
			this._socket.on("browserDisconnected", this._browserDisconnectedHandler);
			this._logger.debug("Attached to socket");	
		}
	};

	Monitor.prototype._browserListHandler = function(browserList){
		this._logger.info("Recieved fresh browser list");
		this._logger.info(browserList);
	};

	Monitor.prototype._browserConnectedHandler = function(browser){
		this._logger.info("Browser connected");
		this._logger.info(browser);
	};

	Monitor.prototype._browserUpdateHandler = function(browserUpdate){
		this._logger.info("Browser update");
		this._logger.info(browserUpdate);
	};

	Monitor.prototype._browserDisconnectedHandler = function(browser){
		this._logger.info("Browser disconnected");
		this._logger.info(browser);
	};

	return exports;
});