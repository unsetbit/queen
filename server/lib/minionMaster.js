var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('../utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js');
	
var create = module.exports = function(socket, options){
	precondition.checkDefined(socket, "MinionMaster requires a socket");

	options = options || {};

	var	self = {
		socket: socket,
		emitter: new EventEmitter(),
		workerProviders: {},
		workforces: {},
		registerationTimeout: options.registerationTimeout || 2000, // 2 seconds,
		log: options.logger || utils.noop
	};

	self.registerWorkerProvider = registerWorkerProvider.bind(self);
	self.getWorkerProviders = getWorkerProviders.bind(self);

	socket.on('connection', connectionHandler.bind(self));

	return getApi.call(self);
};

var getApi = function(){
	var api = getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));

	return api;
};

var kill = function(){
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});

	_.each(this.workerProviders, function(workerProvider){
		workerProvider.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.log('New connection');
	this.emitter.emit('connection', connection);

	timer = setTimeout(function(){
		self.log('Connection timeout');
		self.emitter.emit('timeout', connection);
		connection.disconnect();
	}, this.registerationTimeout);
	
	connection.on("register", function(attributes){
		clearTimeout(timer);
		self.registerWorkerProvider(connection, attributes)
	});
};

var registerWorkerProvider = function(connection, attributes){
	var	self = this, 
		workerProviderId = generateId(),
		workerProvider = createWorkerProvider(connection, {attributes: attributes, logger: this.log});
	
	this.workerProviders[workerProviderId] = workerProvider;		
	workerProvider.on('dead', function(){
		delete self.workerProviders[workerProviderId];
	});

	this.log('New worker provider: ' + workerProviderId);
	this.emitter.emit('workerProvider', workerProvider);
};

var getWorkerProviders = function(filters){
	var results;

	if(!filters) return _.values(this.workerProviders);
	
	if(!_.isArray(filters))	filters = [filters];

	results = _.filter(this.workerProviders, function(workerProvider){
		return _.any(filters, function(filter){
			return utils.isSimilar(filter, workerProvider.attributes);
		});
	});

	return results;
};

var getWorkforce = function(workerConfig, workerHandler){
	var self = this,
		workerProviders = this.getWorkerProviders(workerConfig.hostFilters),
		workerforceId = generateId(),
		workforce = createWorkforce(workerProviders, workerConfig, {workerHandler: workerHandler});

	this.workforces[workerforceId] = workforce;
	workforce.on('dead', function(){
		delete self.workforces[workerforceId];
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce);

	return workforce;
};