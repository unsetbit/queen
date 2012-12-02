var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
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

	self.addWorkerProvider = addWorkerProvider.bind(self);
	self.getWorkerProviders = getWorkerProviders.bind(self);

	socket.on('connection', connectionHandler.bind(self));

	return getApi.call(self);
};

var getApi = function(){
	var self = this,
		api = getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));
	api.getWorkerProvider = getWorkerProvider.bind(self);

	Object.defineProperty(api, 'workerProviders', {
		enumerable: true,
		get: function(){
			return _.values(self.workerProviders);
		}
	});

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
	this.log("Dead");
	this.log = void 0;
};

var getWorkerProvider = function(id){
	return this.workerProviders[id];
};

var connectionHandler = function(connection){
	var self = this,
		timer;
	
	this.log('New connection');
	this.emitter.emit('connection', connection);

	var workerProvider = createWorkerProvider(connection, {logger: this.log});

	timer = setTimeout(function(){
		self.log('Connection timeout');
		self.emitter.emit('timeout', connection);
		connection.disconnect();
	}, this.registerationTimeout);
	
	workerProvider.on('register', function(){
		clearTimeout(timer);
		self.addWorkerProvider(workerProvider);
	});
};

var addWorkerProvider = function(workerProvider){
	var	self = this;
		
	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.log('Worker provider dead: ' + workerProvider.attributes.name);
		delete self.workerProviders[workerProvider.id];
	});

	this.log('New worker provider: ' + workerProvider.attributes.name);
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

var getWorkforce = function(workerConfig){
	var self = this,
		workerProviders = this.getWorkerProviders(workerConfig.hostFilters),
		workerforceId = generateId(),
		workforce = createWorkforce(workerProviders, workerConfig);

	this.workforces[workerforceId] = workforce;
	workforce.on('dead', function(){
		self.log('Workforce dead');
		delete self.workforces[workerforceId];
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce);

	return workforce;
};