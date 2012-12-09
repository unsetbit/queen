var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	generateId = require('node-uuid').v4;

var utils = require('./utils.js'),
	createWorkerProvider  = require('./browserWorkerProvider.js'),
	createWorkforce = require('./workforce.js').create;
	
var create = module.exports = function(socket, options){
	precondition.checkDefined(socket, "MinionMaster requires a socket");

	options = options || {};
	var minionMaster = new MinionMaster(socket);

	if(options.logger) minionMaster.log = options.logger;
	if(options.registerationTimeout) minionMaster.registerationTimeout = options.registerationTimeout;

	return minionMaster.api;
};

var MinionMaster = function(socket){
	this.emitter = new EventEmitter();
	this.workforces = {};
	this.workerProviders = {};
	this.socket = socket;

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

MinionMaster.prototype.log = utils.noop;
MinionMaster.prototype.registerationTimeout = 60 * 1000;

MinionMaster.prototype.kill = function(){
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

MinionMaster.prototype.addWorkerProvider = function(workerProvider){
	var	self = this;
		
	this.workerProviders[workerProvider.id] = workerProvider;		
	workerProvider.on('dead', function(){
		self.log('Worker provider dead: ' + workerProvider.attributes.name);
		delete self.workerProviders[workerProvider.id];
	});

	this.log('New worker provider: ' + workerProvider.attributes.name);
	this.emitter.emit('workerProvider', workerProvider);
};

MinionMaster.prototype.getWorkerProvider = function(id){
	return this.workerProviders[id];
};

MinionMaster.prototype.getWorkerProviders = function(filters){
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

MinionMaster.prototype.connectionHandler = function(connection){
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

MinionMaster.prototype.getWorkforce = function(workerConfig){
	var self = this,
		workerProviders = this.getWorkerProviders(workerConfig.hostFilters),
		workforceId = generateId(),
		workforce = createWorkforce(workerConfig, workerProviders, {
			workerHandler: workerConfig.handler,
			doneHandler: workerConfig.done
		});

	this.workforces[workforceId] = workforce;
	workforce.on('dead', function(){
		self.log('Workforce dead');
		delete self.workforces[workforceId];
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce);

	return workforce;
};