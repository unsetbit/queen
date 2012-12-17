var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	path = require('path'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;
	
var STATIC_DIR = path.resolve(path.dirname(module.filename), '../../static');

var create = module.exports = function(options){
	options = options || {};
	var socket = options.socket;

	if(socket === void 0){
		var httpServer = options.httpServer;
		if(httpServer === void 0){
			// init http server
			var port = options.port || 80,
				host = options.host,
				express = require('express'),
				expressServer = express(),
				webRoot = STATIC_DIR,
				httpServer = require('http').createServer().listen(port, host)
											.on('request', expressServer);

			expressServer.use('', express.static(webRoot));
		}

		// init socket.io
		var socketServer = require("socket.io").listen(httpServer, {log: false});

		socket = socketServer.of("/capture");
	}

	var queen = new Queen(socket);

	if(options.log) queen.log = options.log;
	if(options.debug) queen.debug = options.debug;

	if(options.registerationTimeout) queen.registerationTimeout = options.registerationTimeout;

	if(options.httpServer === void 0){
		queen.log('Listening for browsers on ' + (host!==void 0?host:"*") + ":" + port );
	}

	return queen.api;
};

module.exports.STATIC_DIR = STATIC_DIR;

var Queen = function(socket){
	precondition.checkDefined(socket, "Queen requires a socket");

	this.emitter = new EventEmitter();
	this.workforces = {};
	this.workerProviders = {};
	this.socket = socket;
	this.continuousWorkforces = {};
	
	socket.on('connection', this.connectionHandler.bind(this));

	this.kill = _.once(this.kill.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

var getApi = function(){
	var self = this,
		api = this.getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	api.getWorkerProvider = this.getWorkerProvider.bind(this);

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

Queen.prototype.kill = function(){
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});

	_.each(this.workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
	this.log("Dead");
};

Queen.prototype.addWorkerProvider = function(workerProvider){
	var	self = this;
		
	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.debug('Worker provider dead: ' + workerProvider);
		self.emitter.emit('workerProviderDead', workerProvider.id);
		delete self.workerProviders[workerProvider.id];
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

Queen.prototype.connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.debug('New connection');

	var workerProvider = createWorkerProvider(connection, {log: this.log, debug: this.debug});

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
		workforce;

	workforce = createWorkforce(config, {
		workerHandler: config.handler,
		stopHandler: config.stop,
		providerFilter: config.filter,
		killOnStop: config.killOnStop
	});

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