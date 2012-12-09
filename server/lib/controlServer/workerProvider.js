var utils = require('../utils.js'),
	EventEmitter = require("events").EventEmitter,
	_ = require('underscore');

var create = module.exports = function(workerProvider, onSendToSocket, options){
	var workerProvider = new WorkerProvider(workerProvider, onSendToSocket);

	options = options || {};
	if(options.logger) workerProvider.log = options.logger;

	return getApi.call(workerProvider);
};

var getApi = function(){
	var api = {};
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	return api;
};

var WorkerProvider = function(workerProvider, onSendToSocket){
	this.workerProvider = workerProvider;
	this.sendToSocket = onSendToSocket;

	this.emitter = new EventEmitter();

	this.kill = _.once(this.kill.bind(this));
	this.availableHandler = this.availableHandler.bind(this);
	this.unavailableHandler = this.unavailableHandler.bind(this);
	this.workerHandler = this.workerHandler.bind(this);
	this.workerDeadHandler = this.workerDeadHandler.bind(this);

	workerProvider.on('dead', this.kill);
	workerProvider.on('available', this.availableHandler);
	workerProvider.on('unavailable', this.unavailableHandler);
	workerProvider.on('worker', this.workerHandler);
	workerProvider.on('workerDead', this.workerDeadHandler);
};

WorkerProvider.prototype.log = utils.noop;

WorkerProvider.prototype.kill = function(){
	this.workerProvider.removeListener('dead', this.kill);
	this.workerProvider.removeListener('available', this.availableHandler);
	this.workerProvider.removeListener('unavailable', this.unavailableHandler);
	this.workerProvider.removeListener('worker', this.workerHandler);
	this.workerProvider.removeListener('workerDead', this.workerDeadHandler);
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

WorkerProvider.prototype.workerHandler = function(worker){
	this.sendToSocket({
		type: "worker",
		id: worker.id
	});
};

WorkerProvider.prototype.workerDeadHandler = function(workerId){
	this.sendToSocket({
		type: "workerDead",
		id: workerId
	});
};

WorkerProvider.prototype.unavailableHandler = function(){
	this.sendToSocket({
		type: "unavailable"
	});
};

WorkerProvider.prototype.availableHandler = function(){
	this.sendToSocket({
		type: "available"
	});
};