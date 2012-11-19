var BrowserClient = exports.BrowserClient = function(socket){
	precondition.checkDefined(socket, "Client requires a socket");
	
	this._emitter = new EventEmitter();

	_.bindAll(this,	"_connectHandler",
					"_disconnectHandler",
					"_triggerHandler",
					"_killHandler");

	this._socket = socket;
	this._socket.on("connect", this._connectHandler);
	this._socket.on("disconnect", this._disconnectHandler);

	this._socket.on("trigger", this._triggerHandler);
	this._socket.on("kill", this._killHandler);
}; 

BrowserClient.create = function(options){
	var options = options || {},
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath, {
			'max reconnection attempts': Infinity
		}),
		client = new BrowserClient(socket);
	
	if(options.logger){
		client.setLogger(options.logger);
	}

	return client;
};

BrowserClient.prototype.emit = function(event, data){
	this._emit('echo', {
		event: event,
		data: data
	});
};

BrowserClient.prototype._reset = function(){
	this._trigger('reset');
};

BrowserClient.prototype._reload = function(){
	window.location.reload(true);
};

BrowserClient.prototype.kill = function(){
	this._socket.removeListener("connect", this._connectHandler);
	this._socket.removeListener("disconnect", this._disconnectHandler);

	this._socket.removeListener("trigger", this._triggerHandler);
	this._socket.removeListener("kill", this._killHandler);
	this._socket = void 0;

	this._trigger('dead');
};

BrowserClient.prototype._triggerHandler = function(data){
	var event = data.event,
		eventData = data.data;
	this._trigger(event, eventData);
};

BrowserClient.prototype._killHandler = function(){
	this.kill();
};

BrowserClient.prototype._register = function(){
	var attributes = {},
		capabilities = {};

	attributes.userAgent = navigator.userAgent;

	// fill up capabilities
	_.each(Modernizr, function(value, key){
		if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
			capabilities[key] = value;
		}
	});

	attributes.capabilities = capabilities;

	this._emit("register", attributes);
};

BrowserClient.prototype._emit = function(event, data){
	this._socket.emit(event, data);	
};

// CONNECTION HANDLERS
BrowserClient.prototype._connectHandler = function(){
	if(this._isReconnecting){
		this._reload(); // Reload on reconnect
	} else {
		this._register();
		this._trigger("connected");
	}
};

BrowserClient.prototype._disconnectHandler = function(){
	this._reset();
	this._trigger("disconnected");
	this._isReconnecting = true;
};

// Events
BrowserClient.prototype._trigger = function(event, data){
	this._emitter.trigger(event, [data]);
};

BrowserClient.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

BrowserClient.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

// Logging
BrowserClient.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["info", "disconnected", "Disconnected"],
	["info", "reconnect", "Reconnected"],
	["info", "reset", "Reset"],
	["info", "dead", "Dead"]
];

BrowserClient.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[BrowserClient] ";
	
	if(this._logger !== void 0){
		Utils.stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = Utils.logEvents(logger, this, prefix, this.eventsToLog);
	};
};