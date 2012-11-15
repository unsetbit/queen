var Client = exports.Client = function(socket){
	precondition.checkDefined(socket, "Client requires a socket");
	
	this._emitter = new EventEmitter();

	_.bindAll(this,	"_connectHandler",
					"_disconnectHandler",
					"_echoHandler",
					"_killHandler");

	this._socket = socket;
	this._socket.on("connect", this._connectHandler);
	this._socket.on("disconnect", this._disconnectHandler);

	this._socket.on("echo", this._echoHandler);
	this._socket.on("kill", this._killHandler);
}; 

Client.create = function(options){
	var options = options || {},
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath),
		client = new Client(socket);
	
	if(options.logger){
		client.setLogger(options.logger);
	}

	return client;
};

Client.prototype.emit = function(event, data){
	this._emit('echo', {
		event: event,
		data: data
	});
};

Client.prototype.getAttribute = function(key){
	return this._attributes[key];
};

Client.prototype.getAttributes = function(){
	return _.extend({}, this._attributes);
};

Client.prototype.kill = function(){
	this._socket.removeListener("connect", this._connectHandler);
	this._socket.removeListener("disconnect", this._disconnectHandler);

	this._socket.removeListener("echo", this._echoHandler);
	this._socket.removeListener("kill", this._killHandler);
	this._socket = void 0;

	this._echo('dead');
};

Client.prototype._echoHandler = function(data){
	var event = data.event,
		eventData = data.data;
	this._echo(event, eventData);
};

Client.prototype._killHandler = function(){
	this.kill();
};

Client.prototype._register = function(){
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

Client.prototype._emit = function(event, data){
	this._socket.emit(event, data);	
};

// CONNECTION HANDLERS
Client.prototype._connectHandler = function(){
	this._register();
	this._echo("connected");
};

Client.prototype._disconnectHandler = function(){
	this._echo("disconnected");
}

// Events
Client.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

Client.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Client.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

Client.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

// Logging
Client.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["info", "disconnected", "Disconnected"],
	["debug", "dead", "Dead"]
];

Client.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[Browser] ";
	
	if(this._logger !== void 0){
		Utils.stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = Utils.logEvents(logger, this, prefix, this.eventsToLog);
	};
};