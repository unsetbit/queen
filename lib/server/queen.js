var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	path = require('path'),
	express = require('express'),
	http = require('http'),
	url = require('url'),
	precondition = require('precondition'),
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;

var STATIC_DIR = path.resolve(path.dirname(module.filename), '../../static');

function getExternalIpAddress(){
	var interfaces = require('os').networkInterfaces();
	var addresses = [];
	utils.each(interfaces, function(iface, name){
		addresses = addresses.concat(
			utils.filter(iface, function(node){ 
				return node.family === "IPv4" && node.internal === false;
			})
		);
	});

	if(addresses.length > 0){
		return addresses[0].address;
	}
}

var create = module.exports = function(options){
	options = options || {};

	var socket,
		httpServer,
		socketServer,
		queen,
		callback = options.callback || utils.noop,
		host = options.host || "",
		hostArr = host.split(":"),
		hostname = hostArr[0],
		port = hostArr[1] || 80,
		expressServer = express(),
		webRoot = STATIC_DIR,
		capturePath = "/capture.html",
		captureUrl = "http://" + getExternalIpAddress() + ":" + port + capturePath;

	// Setup http server to capture browsers with
	httpServer = http.createServer();
	httpServer.on('request', expressServer);
	httpServer.on('error', function(error){
		queen.log('Error getting access to start HTTP server on ' + (hostname || "*") + ":" + port + "\n");
		queen.log(error + "\n");
	});
	httpServer.on('listening', function(error){
		queen.log('Listening for browsers on ' + (hostname || "*") + ":" + port +"\n");
		callback(queen.api);
	});
	
	if(hostname === "*") hostname = void 0;
	httpServer.listen(port, hostname);
	expressServer.use('', express["static"](webRoot));

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
	this.httpUrl = url.parse(captureUrl);

	socket.on('connection', this.connectionHandler.bind(this));

	this.kill = _.once(this.kill.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});

	// Used for proxying workforce resources
	this.httpServer.all('/p/:workforceId/*', this.proxyWorkforceResource.bind(this));
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
Queen.prototype.populatorRetryTimeout = 5 * 1000; // 30 seconds

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

Queen.prototype.proxyWorkforceResource = function(request, response){
	var workforceId = request.params.workforceId,
		workforce = this.workforces[workforceId];

	if(workforce === void 0){
		this.debug("Couldn't find requested workforce: " + workforceId + "\n");
		response.send(404);	
	} else if(workforce.runUrl === void 0){
		this.debug("Workforce has no run host: " + workforceId + "\n");
		response.send(404);	
	} else {
		var requestedUrl = request.url;

		var proxyRequest = http.request({
			hostname: workforce.runUrl.hostname,
			port: workforce.runUrl.port,
			method: request.method,
			path: request.url.replace('/p/' + workforceId, ''),
			headers: request.headers
		}, function(proxyResponse){
			response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
			proxyResponse.on('data', function(data){
				response.write(data);
			});

			proxyResponse.on('end', function(){
				response.end();
			});
		});


		proxyRequest.on('error', function(){
			proxyRequest.end();
			response.send(500, "The proxied server closed the connection.");
		});

		request.on('data', function(data){
			proxyRequest.write(data);
		});

		request.on('end', function(){
			proxyRequest.end();
		});
	}
};

Queen.prototype.addWorkerProvider = function(workerProvider){
	var	self = this;

	var clientId = workerProvider.attributes.populatorClientId;
	
	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.log('Worker provider dead: ' + workerProvider + "\n");
		self.emitter.emit('workerProviderDead', workerProvider.id);
		delete self.workerProviders[workerProvider.id];

		if(clientId && clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});

	workerProvider.on('unresponsive', function(){
		self.log('Unresponsive: ' + workerProvider.toString() + "\n");
		self.emitter.emit('workerProviderUnresponsive', workerProvider);
		workerProvider.killWorkers("unresponsive host");
		
		if(clientId && clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});


	workerProvider.on('responsive', function(){
		self.log('Responsive again: ' + workerProvider.toString() + "\n");
		self.emitter.emit('workerProviderResponsive', workerProvider);
	});

	this.log('New worker provider: ' + workerProvider.toString() + "\n");
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
					self.retryPopulation();
					return;
				}

				self.spawnedClients[clientId] = client;
				client.on('dead', function(){
					delete self.spawnedClients[clientId];
					populator.clients.push(clientConfig);
					self.retryPopulation();
				});
			});
		});

		populator.clients = remaining;
	});
};

Queen.prototype.retryPopulation = function(){
	var self = this;
	if(this.repopulateTimeout) return;
	
	this.repopulateTimeout = setTimeout(function(){
		clearTimeout(self.repopulateTimeout);
		self.repopulateTimeout = void 0;
		self.autoSpawnClients();
	}, this.populatorRetryTimeout);	
};

Queen.prototype.connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.debug('New connection\n');

	var workerProvider = createWorkerProvider(connection, {
		log: this.log, 
		debug: this.debug,
		heartbeatInterval: this.heartbeatInterval
	});

	timer = setTimeout(function(){
		self.debug('Connection timeout\n');
		connection.disconnect();
	}, this.registerationTimeout);
	
	workerProvider.on('register', function(){
		clearTimeout(timer);
		self.addWorkerProvider(workerProvider);
	});
};

var HOST_FINDER = /(.*\/\/.*)(?:\/|$)/; // not the most strict regex [todo]

Queen.prototype.getWorkforce = function(config){
	precondition.checkDefined(config, "Worker config must be defined");

	var self = this,
		workerProviders,
		workforceId = generateId(),
		workforce,
		runUrl;

	// Proxy
	if(typeof config.run === "string"){
		runUrl = url.parse(config.run);
		config.run = config.run.replace(HOST_FINDER, "http://" + this.httpUrl.host + "/p/" + workforceId + runUrl.path);
	}

	workforce = createWorkforce(config, {
		workerHandler: config.handler,
		stopHandler: config.stop,
		providerFilter: config.filter,
		killOnStop: config.killOnStop,
		runUrl: runUrl
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
		self.debug('Workforce dead\n');
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

	this.debug('New workforce\n');
	this.emitter.emit('workforce', workforce.api);

	return workforce.api;
};