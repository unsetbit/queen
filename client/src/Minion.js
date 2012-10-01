var Minion = function(socket, emitter, id){
	var self = this;

	if(socket === void 0){
		throw "Minion requires a socket";
	}

	if(emitter === void 0){
		throw "Minion requires an emitter";
	}

	this._id = id;

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
					"_resetHandler",
					"_killHandler");

	this.setSocket(socket);
};

Minion.create = function(options){
	var options = options || {},
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath),
		emitter = options.emitter || new EventEmitter(),
		id = options.id || Minion.getQueryParam("minionId"),
		minion = new Minion(socket, emitter, id);
	
	if(options.logger){
		minion.setLogger(options.logger);
	}

	return minion;
};

// By Artem Barger from http://stackoverflow.com/a/901144
Minion.getQueryParam = function(name)
{
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if(results == null)
    return void 0;
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
}

Minion.prototype.eventsToLog = [
	["info", "connected", "Connected"],
	["info", "disconnected", "Disconnected"],
	["info", "reconnected", "Reconnected"],
	["info", "reconnectFailed", "Reconnection failed"],
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
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};

Minion.prototype.setSocket = function(socket){
	if(this._socket !== void 0){
		this._socket.removeListener("connect", this._connectHandler);
		this._socket.removeListener("disconnect", this._disconnectHandler);
		this._socket.removeListener("reconnect", this._reconnectHandler);
		this._socket.removeListener("reconnected", this._reconnectedHandler);
		this._socket.removeListener("reconnect_failed", this._reconnectFailHandler);

		this._socket.removeListener("echo", this._echoHandler);
		this._socket.removeListener("reset", this._resetHandler);
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
		this._socket.on("reset", this._resetHandler);
		this._socket.on("setId", this._setIdHandler);
		this._echo("socketConnected");
	}
};

Minion.prototype._echo = function(event, data){
	this._emitter.emit(event, data);
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

Minion.prototype._emit = function(event, data){
	if(this._connected){
		this._socket.emit(event, data);	
	} else {
		this._pendingEmissions.push(event, data);
	}
};

Minion.prototype.setAttribute = function(key, value){
	this._attributes[key] = value;
};

Minion.prototype.getAttributes = function(){
	return this._attributes;
};

Minion.prototype._echoHandler = function(data){
	var event = data.event,
		eventData = data.data;
	this._echo(event, eventData);
};

Minion.prototype._resetHandler = function(){
	this.kill();
	window.location.reload(true); // Hard refresh;
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
Minion.prototype._connectHandler = function(){
	this._connected = true;
	this._register();
	this._echo("connected");
};

Minion.prototype._reconnectHandler = function(){
	this._connected = true;
};

Minion.prototype._disconnectHandler = function(){
	this._connected = false;
	this._echo("disconnected");
};

Minion.prototype._reconnectedHandler = function(){
	var pendingEmissions = this._pendingEmissions.slice(0),
		pendingEmission = pendingEmissions.splice(0, 2);

	this._pendingEmissions = [];

	while(pendingEmission.length === 2){
		this._emit(pendingEmission[0], pendingEmission[1]);
		pendingEmission = pendingEmissions.splice(0, 2)
	}
	
	this._echo("reconnected");
};

Minion.prototype._reconnectFailHandler = function(){
	this._echo("reconnectFailed");
	this._kill();
};