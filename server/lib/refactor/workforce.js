var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition')
	uuid = require('node-uuid');

var utils = require('./utils');

var createWorkforce = function(workerProviders, workerConfig, options){
	precondition.checkDefined(workerProviders, "Worker provider list required");

	var self = {},
		emitter = new EventEmitter(),
		api;

	self.emit = emitter.emit.bind(emitter);
	self.workerConfig = workerConfig;
	self.timeout = options.timeout || 1000 * 60;
	self.workerHandler = options.workerHandler || utils.noop;
	self.workers = {};

	api = broadcast.bind(self);
	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = _.once(kill.bind(self));

	workerProviders.forEach(addWorker.bind(self));

	return api;
};

var kill = function(){
	_.each(this.workers, function(worker){
		worker.kill();
	});
	
	this.emit('dead');
};

var broadcast = function(event, data){
	_.each(this.workers, function(worker){
		worker(event, data);
	});
};

var addWorker = function(workerProvider){
	var worker = workerProvider(this.workerConfig, this.timeout);
	if(worker === void 0) return; //worker provider unavailable
	
	this.workers[worker.id] = worker;
	worker.on('dead', function(){
		delete workers[worker.id];
	});

	this.workerHandler(worker);
}