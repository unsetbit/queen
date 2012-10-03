var Minion = function(socket, emitter, id){
	var self = this;

	if(socket === void 0){
		throw "Minion requires a socket";
	}

	if(emitter === void 0){
		throw "Minion requires an emitter";
	}

	this._id = id;

	this._emitter = emitter;

	_.bindAll(this,	"_connectHandler",
					"_disconnectHandler",
					"_setIdHandler", 
					"_echoHandler",
					"_killHandler");

	this.setSocket(socket);
};

Minion.create = function(options){
	var options = options || {},
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath),
		emitter = options.emitter || new EventEmitter(),
		id = options.id || Utils.getQueryParam("minionId"),
		minion = new Minion(socket, emitter, id);
	
	if(options.logger){
		minion.setLogger(options.logger);
	}

	return minion;
};

Minion.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["info", "disconnected", "Disconnected"],
	["debug", "socketConnected", "Socket connected"],
	["debug", "socketDisconnected", "Socket disconnected"],
	["debug", "dead", "Dead"]
];

Minion.prototype.setLogger = function(logger){
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

Minion.prototype.setSocket = function(socket){
	if(this._socket !== void 0){
		this._socket.removeListener("connect", this._connectHandler);
		this._socket.removeListener("disconnect", this._disconnectHandler);

		this._socket.removeListener("echo", this._echoHandler);
		this._socket.removeListener("kill", this._killHandler);
		this._socket.removeListener("setId", this._setIdHandler);	
		this._echo("socketDisconnected");
	}

	this._socket = socket;

	if(this._socket !== void 0){
		this._socket.on("connect", this._connectHandler);
		this._socket.on("disconnect", this._disconnectHandler);

		this._socket.on("echo", this._echoHandler);
		this._socket.on("kill", this._killHandler);
		this._socket.on("setId", this._setIdHandler);
		this._echo("socketConnected");
	}
};

Minion.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
};

Minion.prototype._emit = function(event, data){
	this._socket.emit(event, data);	
};

Minion.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Minion.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

Minion.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

Minion.prototype.emit = function(event, data){
	this._emit('echo', {
		event: event,
		data: data
	});
};

Minion.prototype.getAttributes = function(){
	return this._attributes;
};

Minion.prototype._echoHandler = function(data){
	var event = data.event,
		eventData = data.data;
	this._echo(event, eventData);
};

Minion.prototype._killHandler = function(){
	this.kill();
};

Minion.prototype._setIdHandler = function(id){
	this._id = id;
};

Minion.prototype.kill = function(){
	this.setSocket(void 0);
	this._echo('dead');
};

Minion.prototype.getId = function(){
	return this._id;
};

Minion.prototype._register = function(){
	var attributes = {},
		capabilities = {};

	attributes.id = this.getId();
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

// CONNECTION HANDLERS
Minion.prototype._connectHandler = function(){
	this._register();
	this._echo("connected");
};

Minion.prototype._disconnectHandler = function(){
	this._echo("disconnected");
	this._kill();
};
