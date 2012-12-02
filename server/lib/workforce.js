var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	utils = require('./utils.js'),
	precondition = require('precondition');

var create = module.exports = function(workerProviders, workerConfig){
	precondition.checkDefined(workerProviders, "Worker provider list required");

	var self = {
		emitter: new EventEmitter(),
		workerConfig: workerConfig,
		workerHandler: workerConfig.handler || utils.noop,
		doneHandler: workerConfig.done || utils.done,
		workers: [],
		workerCount: 0
	};

	self.kill = _.once(kill.bind(self));

	workerProviders.forEach(addWorker.bind(self));
	
	if(self.workers.length === 0){
		self.doneHandler();
	}

	return getApi.call(self);
};

var getApi = function(){
	var api = broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	
	return api;
};

var kill = function(){
	this.workers.forEach(function(worker){
		worker.kill();
	});
	
	this.workers = void 0;
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var broadcast = function(message){
	this.workers.forEach(function(worker){
		worker(message);
	});
};

var addWorker = function(workerProvider){
	var self = this,
		worker = workerProvider(this.workerConfig);
	if(worker === void 0) return; // worker provider unavailable
	this.workers.push(worker);
	self.workerCount++;
	worker.on('dead', function(){
		self.workerCount--;
		if(self.workerCount === 0){
			self.doneHandler();
			self.kill();
		}
	});
	worker.on('message', function(message){
		self.emitter.emit('message', message, worker);
	});
	this.workerHandler(worker);
}