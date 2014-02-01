var EventEmitter = require('events').EventEmitter,
	path = require('path'),
	express = require('express'),
	http = require('http'),
	url = require('url'),
	its = require('its'),
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;

var create = module.exports = function(options){
	options = options || {};

	var httpServer,
		socketServer,
		queen,
		callback = options.callback || utils.noop,
		captureHostArr = options.captureHost && options.captureHost.split(':') || [],
		
		// Capture hostname needs a concrete host to avoid CORS issues
		captureHostname = captureHostArr[0] || utils.getExternalIpAddress(),
		caturePort = captureHostArr[1] || 80,
		expressServer = express(),
		captureUrl = 'http://' + captureHostname + ':' + caturePort + '/';

	// Setup http server to capture browsers with
	httpServer = http.createServer();
	httpServer.on('request', expressServer);
	httpServer.on('error', function(error){
		queen.log('[Queen] Error in starting HTTP server on ' + captureHostname + ':' + caturePort + '\n');
		queen.log(error + '\n');
	});
	httpServer.on('listening', function(){
		queen.log('[Queen] Capturing browsers at ' + captureUrl + '\n');
		callback(getApi(queen));
	});
	
	httpServer.listen(caturePort, captureHostname);

	socketServer = require('socket.io').listen(httpServer, {log: false});

	queen = new Queen(socketServer, expressServer, captureUrl);

	if(options.log) queen.log = options.log;
	if(options.debug) queen.debug = options.debug;
	if(options.registerationTimeout) queen.registerationTimeout = options.registerationTimeout;
	if(options.heartbeatInterval) queen.heartbeatInterval = options.heartbeatInterval;
};

module.exports.protocol = require('../protocol.js');
var WEB_ROOT = module.exports.WEB_ROOT = path.resolve(path.dirname(module.filename), '../../static');

function getApi(queen){
	var api = queen.getWorkforce.bind(queen);

	api.on = queen.emitter.on.bind(queen.emitter);
	api.removeListener = queen.emitter.removeListener.bind(queen.emitter);
	api.kill = queen.kill;
	api.getWorkerProvider = queen.getWorkerProvider.bind(queen);
	api.acquireWebSocketEndpoint = queen.acquireWebSocketEndpoint.bind(queen);
	api.assignHttpEndpoint = queen.assignHttpEndpoint.bind(queen);
	api.captureUrl = queen.captureUrl;

	Object.defineProperty(api, 'log', {
		enumerable: true,
		get: function(){
			return queen.log;
		}
	});

	Object.defineProperty(api, 'debug', {
		enumerable: true,
		get: function(){
			return queen.debug;
		}
	});

	Object.defineProperty(api, 'workerProviders', {
		enumerable: true,
		get: function(){
			return utils.values(queen.workerProviders);
		}
	});

	return api;
}

function Queen(socketServer, expressServer, captureUrl){
	its.object(socketServer, 'Queen requires a socketServer');
	its.string(captureUrl, 'Capture url is required');
	its.object(expressServer, 'express instance is required');
	
	this.emitter = new EventEmitter();
	this.workforces = {};
	this.workerProviders = {};
	this.socketServer = socketServer;
	this.usedEndpoints = [];
	this.continuousWorkforces = {};
	this.captureUrl = captureUrl;
	this.expressServer = expressServer;
	this.httpUrl = url.parse(captureUrl);
	this.socket = this.acquireWebSocketEndpoint(this.captureWebSocketEndpoint);

	this.socket.on('connection', this.connectionHandler.bind(this));

	this.assignHttpEndpoint('', WEB_ROOT);

	this.kill = utils.once(this.kill.bind(this));

	// Used for proxying workforce resources
	this.expressServer.all('/p/:workforceId/*', this.proxyWorkforceResource.bind(this));
}

Queen.prototype.captureWebSocketEndpoint = '/capture';
Queen.prototype.debug = utils.noop;
Queen.prototype.log = utils.noop;
Queen.prototype.registerationTimeout = 60 * 1000; // 60 seconds

Queen.prototype.acquireWebSocketEndpoint = function(path){
	its.string(path, 'Endpoint must be a path');

	if(~this.usedEndpoints.indexOf(path)) return false;
	this.usedEndpoints.push(path);
	
	return this.socketServer.of(path);
};

Queen.prototype.assignHttpEndpoint = function(path, webRoot){
	its.string(path, 'Endpoint must be a path');
	
	if(~this.usedEndpoints.indexOf(path)) return false;
	this.usedEndpoints.push(path);

	this.expressServer.use(path, express['static'](webRoot));
	return true;
};

Queen.prototype.kill = function(callback){
	var waitingCounter = 0;
	function decrementWaitingCounter(){
		waitingCounter--;
		if(waitingCounter === 0 && callback){
			callback();
		}
	}

	utils.each(this.workforces, function(workforce){
		workforce.kill();
	});

	utils.each(this.workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
	this.log('Dead');
};

Queen.prototype.proxyWorkforceResource = function(request, response){
	var workforceId = request.params.workforceId,
		workforce = this.workforces[workforceId];

	if(workforce === void 0){
		this.debug('[Queen] Can\'t fulfill proxy request, workforce unknown: ' + workforceId + '\n');
		response.send(404);	
	} else if(workforce.runUrl === void 0){
		this.debug('[Queen] Can\'t fulfill proxy request, workforce has no run host: ' + workforceId + '\n');
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
			response.send(500, 'The proxied server closed the connection.');
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

	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.log('[Queen] Worker provider dead: ' + workerProvider + '\n');
		self.emitter.emit('workerProviderDead', workerProvider.id);
		delete self.workerProviders[workerProvider.id];
	});

	workerProvider.on('unresponsive', function(){
		self.log('[Queen] Worker provider unresponsive: ' + workerProvider.toString() + '\n');
		self.emitter.emit('workerProviderUnresponsive', workerProvider);
		workerProvider.killWorkers('unresponsive host');
	});

	workerProvider.on('responsive', function(){
		self.log('[Queen] Worker provider responsive again: ' + workerProvider.toString() + '\n');
		self.emitter.emit('workerProviderResponsive', workerProvider);
	});

	this.log('[Queen] New worker provider: ' + workerProvider.toString() + '\n');
	this.emitter.emit('workerProvider', workerProvider);

	utils.each(this.continuousWorkforces, function(workforce){
		workforce.populate(workerProvider);
	});
};

Queen.prototype.getWorkerProvider = function(id){
	return this.workerProviders[id];
};

Queen.prototype.getWorkerProviders = function(){
	return utils.values(this.workerProviders);
};

Queen.prototype.connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.debug('[Queen] New connection on capture port\n');

	var workerProvider = createWorkerProvider(connection, {
		log: this.log, 
		debug: this.debug,
		heartbeatInterval: this.heartbeatInterval
	});

	timer = setTimeout(function(){
		self.debug('[Queen] Connection on capture port didn\'t register within timeout period\n');
		connection.disconnect();
	}, this.registerationTimeout);
	
	workerProvider.on('register', function(){
		clearTimeout(timer);
		self.addWorkerProvider(workerProvider);
	});
};

var HOST_FINDER = /(.*\/\/.*)(?:\/|$)/; // not the most strict regex [todo]

Queen.prototype.getWorkforce = function(config){
	its.object(config, 'Worker config must be defined');

	var self = this,
		workforceId = generateId(),
		workforce,
		runUrl;

	// Proxy single string requests
	if(typeof config.run === 'string'){
		// Keep track of the original url
		runUrl = url.parse(config.run);
		config.run = config.run.replace(HOST_FINDER, 'http://' + this.httpUrl.host + '/p/' + workforceId + runUrl.path);
	}

	workforce = createWorkforce(config, {
		workerHandler: config.handler,
		stopHandler: config.stop,
		providerFilter: config.filter,
		uniquenessFilter: config.uniqueness,
		killOnStop: config.killOnStop,
		runUrl: runUrl
	});

	if(config.workforceTimeout){
		var timeout = setTimeout(function(){
			workforce.kill();
		}, config.workforceTimeout);

		workforce.api.on('dead', function(){
			clearTimeout(timeout);
		});
	}

	this.workforces[workforceId] = workforce.api;
	
	workforce.api.on('dead', function(){
		self.debug('[Queen] Workforce dead\n');
		self.emitter.emit('workforceDead', workforce.api.id);
		delete self.workforces[workforceId];
	});

	if(config.populate !== 'manual'){
		workforce.api.on('start', function(){
			workforce.populate(self.getWorkerProviders());

			if(config.populate === 'continuous'){
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

	this.debug('[Queen] New workforce\n');
	this.emitter.emit('workforce', workforce.api);

	return workforce.api;
};