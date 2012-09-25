define(function(require, exports, module) {
    var EventEmitter = require('../lib/nodeEvents.js').EventEmitter,
    	logEvents = require("./utils.js").logEvents,
		stopLoggingEvents = require("./utils.js").stopLoggingEvents;

	exports.create = function(socket, options){
		var options = options || {},
			emitter = options.emitter || new EventEmitter(),
			browser = new Browser(socket, emitter);
		
		if(options.logger){
			browser.setLogger(options.logger);
		}

		return browser;
	};

	exports.Browser = Browser = function(socket, emitter, logger){
		var self = this;

		if(socket === void 0){
			throw "Browser requires a socket";
		}

		this._id = void 0;

		this._pendingEmissions = [];
		
		this._logger = void 0;
		this._loggingFunctions = void 0;

		this._emitter = emitter;
		this._userAgent = navigator.userAgent;

		_.bindAll(this,	"_connectHandler",
						"_disconnectHandler",
						"_reconnectHandler",
						"_reconnectedHandler",
						"_reconnectFailHandler", 
						"_setIdHandler", 
						"_echoHandler",
						"_killHandler");

		this.setSocket(socket);
	};

	Browser.prototype.eventsToLog = [
		["info", "connected", "Connected"],
		["info", "disconnected", "Disconnected"],
		["info", "reconnected", "Reconnected"],
		["info", "reconnectFailed", "Reconnection failed"],
		["debug", "socketConnected", "Socket connected"],
		["debug", "socketDisconnected", "Socket disconnected"],
		["debug", "dead", "Dead"]
	];

	Browser.prototype.setLogger = function(logger){
		if(this._logger === logger){
			return; // same as existing one
		}
		
		var prefix = "[Browser] ";
		
		if(this._logger !== void 0){
			stopLoggingEvents(this, this._loggingFunctions);
		};

		this._logger = logger;

		if(this._logger !== void 0){
			this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
		};
	};

	Browser.prototype.setSocket = function(socket){
		if(this._socket !== void 0){
			this._socket.removeListener("connect", this._connectHandler);
			this._socket.removeListener("disconnect", this._disconnectHandler);
			this._socket.removeListener("reconnect", this._reconnectHandler);
			this._socket.removeListener("reconnected", this._reconnectedHandler);
			this._socket.removeListener("reconnect_failed", this._reconnectFailHandler);

			this._socket.removeListener("echo", this._echoHandler);
			this._socket.removeListener("kill", this._killHandler);
			this._socket.removeListener("setId", this._setIdHandler);	
			this._echo("socketDisconnected");
		}

		this._socket = socket;

		if(this._socket !== void 0){
			this._socket.on("connect", this._connectHandler);
			this._socket.on("disconnect", this._disconnectHandler);
			this._socket.on("reconnect", this._reconnectHandler);
			this._socket.on("reconnected", this._reconnectedHandler);
			this._socket.on("reconnect_failed", this._reconnectFailHandler);

			this._socket.on("echo", this._echoHandler);
			this._socket.on("kill", this._killHandler);
			this._socket.on("setId", this._setIdHandler);
			this._echo("socketConnected");
		}
	};

	Browser.prototype._echo = function(event, data){
		this._emitter.emit(event, data);
	};

	Browser.prototype.on = function(event, callback){
		this._emitter.on(event, callback);
	};

	Browser.prototype.once = function(event, callback){
		this._emitter.once(event, callback);
	};

	Browser.prototype.removeListener = function(event, callback){
		this._emitter.removeListener(event, callback);
	};

	Browser.prototype.emit = function(event, data){
		this._emit('echo', {
			event: event,
			data: data
		});
	};

	Browser.prototype._emit = function(event, data){
		if(this._connected){
			this._socket.emit(event, data);	
		} else {
			this._pendingEmissions.push(event, data);
		}
	};

	Browser.prototype.setAttribute = function(key, value){
		this._attributes[key] = value;
	};

	Browser.prototype.getAttributes = function(){
		return this._attributes;
	};

	Browser.prototype._echoHandler = function(data){
		var event = data.event,
			eventData = data.data;
		this._echo(event, eventData);
	};

	Browser.prototype._killHandler = function(){
		this.setSocket(void 0);
		this._echo('dead');
	};

	Browser.prototype._setIdHandler = function(id){
		this._id = id;
		this.reset();
	};

	Browser.prototype.getId = function(){
		return this._id;
	};

	Browser.prototype.reset = function(){
		this._echo('reset');
	};

	Browser.prototype._register = function(){
		var attributes = {},
			capabilities = {};

		// fill up capabilities
		_.each(Modernizr, function(value, key){
			if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
				capabilities[key] = value;
			}
		});

		attributes.id = this.getId();
		attributes.userAgent = this._userAgent;
		attributes.capabilities = capabilities;

		this._emit("register", attributes);
	};

	// CONNECTION HANDLERS
	Browser.prototype._connectHandler = function(){
		this._connected = true;
		this._register();
		this._echo("connected");
	};

	Browser.prototype._reconnectHandler = function(){
		this._connected = true;
	};

	Browser.prototype._disconnectHandler = function(){
		this._connected = false;
		this._echo("disconnected");
	};

	Browser.prototype._reconnectedHandler = function(){
		var pendingEmissions = this._pendingEmissions.slice(0),
			pendingEmission = pendingEmissions.splice(0, 2);

		this._pendingEmissions = [];

		while(pendingEmission.length === 2){
			this._emit(pendingEmission[0], pendingEmission[1]);
			pendingEmission = pendingEmissions.splice(0, 2)
		}
		
		this._echo("reconnected");
	};

	Browser.prototype._reconnectFailHandler = function(){
		this._echo("reconnectFailed");
		this._kill();
	};

	return exports;
});