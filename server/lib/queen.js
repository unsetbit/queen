var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;
	
var create = module.exports = function(socket, options){
	precondition.checkDefined(socket, "Queen requires a socket");

	options = options || {};
	var queen = new Queen(socket);

	if(options.logger) queen.log = options.logger;
	if(options.registerationTimeout) queen.registerationTimeout = options.registerationTimeout;

	return queen.api;
};

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
		self.log('Worker provider dead' + workerProvider);
		self.emitter.emit('workerProviderDead: ', workerProvider.id);
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
	
	this.log('New connection');

	var workerProvider = createWorkerProvider(connection, {logger: this.log});

	timer = setTimeout(function(){
		self.log('Connection timeout');
		connection.disconnect();
	}, this.registerationTimeout);
	
	workerProvider.on('register', function(){
		clearTimeout(timer);
		self.addWorkerProvider(workerProvider);
	});
};

Queen.prototype.getWorkforce = function(workerConfig){
	precondition.checkDefined(workerConfig, "Worker config must be defined");

	var self = this,
		workerProviders,
		workforceId = generateId(),
		workforce;

	workforce = createWorkforce(workerConfig, {
		workerHandler: workerConfig.handler,
		stopHandler: workerConfig.stop,
		providerFilter: workerConfig.filter,
		killOnStop: workerConfig.killOnStop
	});

	this.workforces[workforceId] = workforce.api;
	
	workforce.api.on('dead', function(){
		self.log('Workforce dead');
		self.emitter.emit('workforceDead', workforce.api.id);
		delete self.workforces[workforceId];
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce.api);

	if(workerConfig.populate !== false){
		workerProviders = this.getWorkerProviders()
		
		if(workerConfig.populate === void 0
		   || workerConfig.populate === "once"){
			workforce.populate(workerProviders);
		} else if(workerConfig.populate === "continuous"){
			this.continuousWorkforces[workforceId] = workforce;			
			workforce.api.on('dead', function(){
				delete self.continuousWorkforces[workforceId];
			});

			workforce.populate(workerProviders);
		}
	}

	return workforce.api;
};