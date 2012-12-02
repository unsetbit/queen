var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition');

var create = module.exports = function(workerProviders, workerConfig, options){
	options = options || {};

	precondition.checkDefined(workerProviders, "Worker provider list required");

	var self = {
		emitter: new EventEmitter(),
		workerConfig: workerConfig,
		workerHandler: options.workerHandler || utils.noop,
		workers: []
	};

	workerProviders.forEach(addWorker.bind(self));

	return getApi.call(self);
};

var getApi = function(){
	var api = broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));
	
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

var broadcast = function(event, data){
	this.workers.forEach(function(worker){
		worker(event, data);
	});
};

var addWorker = function(workerProvider){
	var worker = workerProvider(this.workerConfig);
	if(worker === void 0) return; //worker provider unavailable
	this.workers.push(worker);
	this.workerHandler(worker);
}