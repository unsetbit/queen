var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	utils = require('./utils.js'),
	precondition = require('precondition');

var Workforce = exports.Workforce = function(){
	this.emitter = new EventEmitter();
	this.workers = [];
	this.workerCount = 0;

	this.kill = _.once(this.kill.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

var getApi = function(){
	var api = this.broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	
	return api;
};

Workforce.prototype.workerHandler = utils.noop;
Workforce.prototype.doneHandler = utils.noop;

Workforce.prototype.kill = function(){
	this.workers.forEach(function(worker){
		worker.kill();
	});
	
	this.workers = [];
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

Workforce.prototype.broadcast = function(message){
	this.workers.forEach(function(worker){
		worker(message);
	});
};

Workforce.prototype.addWorker = function(worker){
	var self = this;

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