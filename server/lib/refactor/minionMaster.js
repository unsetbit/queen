var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	uuid = require('node-uuid');

var utils = require('./utils'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js');
	
var create = function(socket, options){
	precondition.checkDefined(socket, "MinionMaster requires a socket");

	options = options || {};

	var	self = {},
		emitter = new EventEmitter();

	self.socket = socket;
	self.workerProviders = {};
	self.workforces = {};
	self.registerationTimeout = options.registerationTimeout || 2000; // 2 seconds
	self.log = options.logger || utils.noop;
	self.emit = emitter.emit.bind(self);

	socket.on('connection', connectionHandler.bind(self));

	var api = getWorkforce.bind(self);
	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = _.once(kill.bind(self));

	return api;
};

var kill = function(){
	_.each(self.workforces, function(workforce){
		workerforce.kill();
	});

	_.each(self.workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	
	self.emit('dead');
};

var connectionHandler = function(connection){
	var self = this,
		workerProviders = this.workerProviders,
		registerationTimer;
	
	this.log('New connection');
	self.emit('connection', connection);

	registerationTimer = setTimeout(function(){
		this.log('Connection timeout');
		self.emit('timeout', connection);
		connection.disconnect();
	}, self.registerationTimeout);
	
	connection.on("register", function(attributes){
		var workerProvider,
			workerProviderId = uuid.v4();

		clearTimeout(registerationTimeout);
		
		workerProvider = createWorkerProvider(connection, {attributes: attributes, logger: self.log});
		workerProviders[workerProviderId] = workerProvider;		
		workerProvider.on('dead', function(){
			delete workerProviders[workerProviderId];
		});

		this.log('New worker provider: ' + workerProviderId);
		self.emit('workerProvider', workerProvider);
	});
};

var getWorkerProviders = function(workerProviders, filters){
	if(!filters) return _.values(workerProviders);
	
	if(!_.isArray(filters))	filters = [filters];

	var results = _.filter(workerProviders, function(workerProvider){
		return _.any(filters, function(filter){
			return utils.isSimilar(filter, workerProvider.attributes);
		});
	});

	return results;
};

var getWorkforce = function(workerConfig, options){
	if(options === void 0) return;

	var workerProviders = getWorkerProviders(this.workerProviders, options.hostFilters),
		workforces = this.workforces,
		workforce = createWorkforce(workerProviders, workerConfig, options);

	workforces[workforce.id] = workforce;
	workforce.on('dead', function(){
		delete workforces[workforce.id];
	});

	this.log('New workforce');
	this.emit('workforce', workforce);

	return workforce;
};