var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	uuid = require('node-uuid'),
	precondition = require('precondition');

var createClient = require("./client.js").create,
	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

/** Factory function for ClientHub instances
* 
*	@param {Object} socketServer A socket server to monitor connections on
*	@param {Object} [options] A map of optional construction parameters
*	@param {Object} [options.logger] A logger to output logging to
*	@param {Number} [options.registerationTimeout] Timeout to determine how long
						to wait for a connection to register before closing it
*/
exports.create = function(socketServer, options){
	precondition.checkDefined(socketServer, "ClientHub requires a socket server");
	
	var options = options || {},
		clientHub = new ClientHub(socketServer);

	// If logger exists, attach to it
	if(options.logger){
		clientHub.setLogger(options.logger);
	}
	
	if(options.registerationTimeout){
		clientHub.registerationTimeout = options.registerationTimeout;
	}

	return clientHub;
};

/** ClientHub keeps track of connected clients
*
* @constructor
* @param socketServer The socketServer server to which clients establish connection with
*/
var ClientHub = exports.ClientHub = function(socketServer){
	precondition.checkDefined(socketServer, "ClientHub requires a socket server");

	this._id = uuid.v4();
	this._emitter = new EventEmitter();
	this._clients = {};
	this._server = socketServer;

	_.bindAll(this, "_connectionHandler");
	this._server.on("connection", this._connectionHandler);
};

/** @default */
ClientHub.prototype.registerationTimeout = 2000;

/**	Gets the ClientHub id
*
*	@returns {String} A globally unique string identifying this instance
*/
ClientHub.prototype.getId = function(){
	return this._id;
};

/** Given a list of filters, returns all matching clients in the client
* 	pool. Filters are maps of desired attributes.
*
* 	@param {Array<Object>} filters The attributes to match against
*
* 	@returns {Array<Client>} The matching clients
*/
ClientHub.prototype.getClients = function(filters){
	if(!_.isArray(filters)){
		filters = [filters];
	}

	var clients = _.filter(this._clients, function(client){
		return _.any(filters, function(filter){
			return client.hasAttributes(filter);
		});
	});

	return clients;
};

/**	Kills this instance
*
* 	@fires ClientHub#dead
*/
ClientHub.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;
	
	_.each(this._clients, function(client){
		client.kill();
	});
	this._clients = {};
	
	this._server.removeListener("connection", this._connectionHandler);
	
	/**
	* Signals that this object should no longer be used
	* 
	* @event ClientHub#dead
	*/
	this._emit("dead");
	this._emitter.removeAllListeners();
};

// EVENT HANDLERS
ClientHub.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

ClientHub.prototype.once = function(event, callback){
	this._emitter.once(event, callback);
};

ClientHub.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

ClientHub.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

/** Attach a client instance to the hub
*
*	@private
*	@param {Client} client A client instance to attach
*   @fires ClientHub#clientConnected
*/
ClientHub.prototype._attachClient = function(client){
	clientId = client.getId();
	this._clients[clientId] = client;

	/**
	*	@event ClientHub#clientConnected
	*	@property {Client} The client instance that has connected
	*/
	this._emit("clientConnected", client);
};

/** Detach a client instance from the hub
*
*	@private
*	@param {Client} client The client instance to detach
*	@fires ClientHub#clientDisconnected
*/
ClientHub.prototype._detachClient = function(client){
	var clientId = client.getId();

	if(this._clients[clientId] !== void 0){
		client.kill();

		delete this._clients[clientId];

		/**
		*	@event ClientHub#clientDisconnected
		*	@property {Client} The client instance that has connected
		*/
		this._emit("clientDisconnected", client);
	}
};

/** Handles new connections on the socket server
*
*	@private
*	@param {Socket} socket The socket that has just connected
*	@fires ClientHub#socketConnected
*	@fires ClientHub#socketDisconnected
*/
ClientHub.prototype._connectionHandler = function(socket){
	var self = this;
	
	/**
	*	@event ClientHub#socketConnected
	*	@property {Socket} The socket that has connected
	*/
	self._emit("socketConnected", socket);

	var registerationTimeout = setTimeout(function(){
		socket.disconnect();
	}, this.registerationTimeout);
	
	socket.on("register", function(registerationData){
		var client;

		clearTimeout(registerationTimeout);
		
		client = createClient(socket, {attributes: registerationData, logger: self._logger});
		self._attachClient(client);
		
		socket.on("disconnect", function(){

			/**
			*	@event ClientHub#socketDisconnected
			*	@property {Socket} The socket that has disconnected
			*/
			self._detachClient(client);
		});
	});

	socket.on('disconnect', function(){
		self._emit("socketDisconnected");
	});
};

// Optional logging helpers
ClientHub.prototype.eventsToLog = [
	["debug", "socketConnected", "Socket connected"],
	["debug", "socketDisconnected", "Socket disconnected"],
	["info", "clientConnected", "Client connected"],
	["info", "clientDisconnected", "Client disconnected"]
];

ClientHub.prototype.setLogger = function(logger){
	var prefix = "[ClientHub-" + this.getId().substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};