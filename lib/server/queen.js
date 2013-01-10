var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	path = require('path'),
	express = require('express'),
	http = require('http'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;

var STATIC_DIR = path.resolve(path.dirname(module.filename), '../../static');

var create = module.exports = function(options){
	options = options || {};

	var socket,
		httpServer,
		socketServer,
		queen,
		callback = options.callback || utils.noop,
		port = options.port || 80,
		host = options.host,
		expressServer = express(),
		webRoot = STATIC_DIR,
		capturePath = "/capture.html",
		captureUrl = "http://" + (host || "localhost") + ":" + port + capturePath,
		httpServer;

	// Setup http server to capture browsers with
	httpServer = http.createServer();
	httpServer.on('request', expressServer);
	httpServer.on('error', function(error){
		queen.log('Error getting access to start HTTP server on ' + (host || "*") + ":" + port);
		queen.log(error);
	});
	httpServer.on('listening', function(error){
		queen.log('Listening for browsers on ' + (host || "*") + ":" + port );
		callback(queen.api);
	});
	httpServer.listen(port, host);
	expressServer.use('', express.static(webRoot));

	// init socket.io
	socketServer = require("socket.io").listen(httpServer, {log: false});
	socket = socketServer.of("/capture");

	queen = new Queen(socket, captureUrl, expressServer);

	if(options.log) queen.log = options.log;
	if(options.debug) queen.debug = options.debug;
	if(options.registerationTimeout) queen.registerationTimeout = options.registerationTimeout;
	if(options.heartbeatInterval) queen.heartbeatInterval = options.heartbeatInterval;
	if(options.monitor !== false){
		var monitorSocket = socketServer.of("/monitor"),
			monitor = require('./monitor.js')(queen.api, monitorSocket);
	}
};

module.exports.STATIC_DIR = STATIC_DIR;

var Queen = function(socket, captureUrl, httpServer){
	precondition.checkDefined(socket, "Queen requires a socket");

	this.emitter = new EventEmitter();
	this.workforces = {};
	this.workerProviders = {};
	this.socket = socket;
	this.continuousWorkforces = {};
	this.captureUrl = captureUrl;
	this.populators = [];
	this.spawnedClients = {};
	this.httpServer = httpServer;

	socket.on('connection', this.connectionHandler.bind(this));

	this.kill = _.once(this.kill.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});

	this.httpServer.all('/w/:workforceId', this.getWorkforceResource.bind(this));
};

var getApi = function(){
	var self = this,
		api = this.getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	api.getWorkerProvider = this.getWorkerProvider.bind(this);
	api.attachPopulator = this.attachPopulator.bind(this);
	api.detachPopuulator = this.detachPopulator.bind(this);

	Object.defineProperty(api, 'workerProviders', {
		enumerable: true,
		get: function(){
			return _.values(self.workerProviders);
		}
	});

	return api;
};

Queen.prototype.debug = utils.noop;
Queen.prototype.log = utils.noop;
Queen.prototype.registerationTimeout = 10 * 1000; // 10 seconds
Queen.prototype.populatorRetryTimeout = 30 * 1000; // 10 seconds

Queen.prototype.kill = function(callback){
	var waitingCounter = 0;
	function decrementWaitingCounter(){
		waitingCounter--;
		if(waitingCounter === 0 && callback){
			callback();
		}
	}

	_.each(this.workforces, function(workforce){
		workforce.kill();
	});

	_.each(this.workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	
	_.each(this.spawnedClients, function(client){
		waitingCounter++;
		client.kill(decrementWaitingCounter);
	});

	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
	this.log("Dead");
};

Queen.prototype.getWorkforceResource = function(request, response){
	var workforceId = request.params.workforceId,
		workforce = this.workforces[workforceId];

	if(workforce === void 0 || workforce.runResource === void 0){
		this.log("Couldn't find requested group: " + workforceId);
		response.send(404);	
		return;
	}

	response.send(200, workforce.runResource);
};

Queen.prototype.addWorkerProvider = function(workerProvider){
	var	self = this;

	var clientId = workerProvider.attributes.populatorClientId;
	
	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.log('Worker provider dead: ' + workerProvider);
		self.emitter.emit('workerProviderDead', workerProvider.id);
		delete self.workerProviders[workerProvider.id];

		if(clientId && clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});

	workerProvider.on('unresponsive', function(){
		self.log('Unresponsive: ' + workerProvider.toString());
		self.emitter.emit('workerProviderUnresponsive', workerProvider);
		workerProvider.killWorkers("unresponsive host");
		
		if(clientId && clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});


	workerProvider.on('responsive', function(){
		self.log('Responsive again: ' + workerProvider.toString());
		self.emitter.emit('workerProviderResponsive', workerProvider);
	});

	this.log('New worker provider: ' + workerProvider.toString());
	this.emitter.emit('workerProvider', workerProvider);

	_.each(this.continuousWorkforces, function(workforce){
		workforce.populate(workerProvider);
	});
};

Queen.prototype.getWorkerProvider = function(id){
	return this.workerProviders[id];
};

Queen.prototype.getWorkerProviders = function(){
	return _.values(this.workerProviders);
};

Queen.prototype.attachPopulator = function(populator){
	this.populators.push(populator);
	this.autoSpawnClients();
};

Queen.prototype.detachPopulator = function(populator){
	var index = this.populators.indexOf(populator);
	
	if(!~index) return;
	
	this.populators.splice(index, 1);
};

Queen.prototype.autoSpawnClients = function(){
	var self = this,
		hasRemaining = false;

	this.populators.forEach(function(populator){
		var remaining = [],
			retryTimeout;

		populator.clients.forEach(function(clientConfig){
			var clientId = generateId();
			clientConfig.captureUrl = self.captureUrl + "?clientId=" + clientId;
			populator(clientConfig, function(client){
				// If populator was unable to spawn the client, add it back to
				// the queue
				if(!client){
					remaining.push(clientConfig);
					clearTimeout(retryTimeout);
					retryTimeout = setTimeout(function(){
						self.autoSpawnClients();
					}, this.populatorRetryTimeout);
					return;
				}

				self.spawnedClients[clientId] = client;
				client.on('dead', function(){
					delete self.spawnedClients[clientId];
					populator.clients.push(clientConfig);
					self.autoSpawnClients();
				});
			});
		});
		populator.clients = remaining;
	});

	// If a populator wasn't able to spawn a client, try again after a while
	if(hasRemaining){
		retryTimeout = setTimeout(function(){
			self.autoSpawnClients();
		}, this.populatorRetryTimeout);
	}
};

Queen.prototype.connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.debug('New connection');

	var workerProvider = createWorkerProvider(connection, {
		log: this.log, 
		debug: this.debug,
		heartbeatInterval: this.heartbeatInterval
	});

	timer = setTimeout(function(){
		self.debug('Connection timeout');
		connection.disconnect();
	}, this.registerationTimeout);
	
	workerProvider.on('register', function(){
		clearTimeout(timer);
		self.addWorkerProvider(workerProvider);
	});
};

Queen.prototype.getWorkforce = function(config){
	precondition.checkDefined(config, "Worker config must be defined");

	var self = this,
		workerProviders,
		workforceId = generateId(),
		workforce,
		runResource;

	if(typeof config.run === "string"){
		runResource = config.run;
		config.run = '/w/' + workforceId;
	}

	workforce = createWorkforce(config, {
		workerHandler: config.handler,
		stopHandler: config.stop,
		providerFilter: config.filter,
		killOnStop: config.killOnStop,
		runResource: runResource
	});

	if(config.workforceTimeout){
		timeout = setTimeout(function(){
			workforce.kill();
		}, config.workforceTimeout);

		workforce.api.on('dead', function(){
			clearTimeout(timeout);
		});
	}

	this.workforces[workforceId] = workforce.api;
	
	workforce.api.on('dead', function(){
		self.debug('Workforce dead');
		self.emitter.emit('workforceDead', workforce.api.id);
		delete self.workforces[workforceId];
	});

	if(config.populate !== "manual"){
		workforce.api.on('start', function(){
			workforce.populate(self.getWorkerProviders());

			if(config.populate === "continuous"){
				self.continuousWorkforces[workforceId] = workforce;			
				workforce.api.on('dead', function(){
					delete self.continuousWorkforces[workforceId];
				});
			}
		});
	}
	
	if(config.autoStart !== false){
		workforce.start();
	}

	this.debug('New workforce');
	this.emitter.emit('workforce', workforce.api);

	return workforce.api;
};