var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	utils = require('./utils.js'),
	precondition = require('precondition');

exports.create = function(workerConfig, options){
	var workforce = new Workforce(workerConfig);

	if(options.doneHandler) workforce.doneHandler = options.doneHandler;
	if(options.workerHandler) workforce.workerHandler = options.workerHandler;

	return workforce;
};

var Workforce = exports.Workforce = function(workerConfig){
	var self = this;
	this.emitter = new EventEmitter();
	this.workers = [];
	this.workerCount = 0;
	this.workerConfig = workerConfig;
	this.pendingWorkers = 0;
	this.pendingMessages = [];

	this.kill = _.once(this.kill.bind(this));
	this.api = Object.freeze(getApi.call(this));
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

Workforce.prototype.populate = function(workerProviders){
	var self = this;

	self.pendingWorkers += workerProviders.length;
	workerProviders.forEach(function(workerProvider){
		if(!_.isFunction(workerProvider)) return;
		
		workerProvider(self.workerConfig, function(worker){
			self.pendingWorkers--;
			if(worker !== void 0){
				self.addWorker(worker);
			}

			if(self.pendingWorkers === 0){
				this.pendingMessages = [];
				if(self.workerCount === 0){
					self.doneHandler();
					self.kill();
				}
			}
		});
	});

	if(this.pendingWorkers === 0 && this.workerCount === 0){
		this.doneHandler();
		this.kill();
	}
};

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

	if(this.pendingWorkers > 0){
		this.pendingMessages.push(message);
	}
};

Workforce.prototype.addWorker = function(worker){
	var self = this;

	this.workers.push(worker);
	this.workerCount++;
	worker.on('dead', function(){
		self.workerCount--;

		if(self.pendingWorkers === 0 && self.workerCount === 0){
			self.doneHandler();
			self.kill();
		}
	});

	worker.on('message', function(message){
		self.emitter.emit('message', message, worker);
	});

	if(this.pendingMessages > 0){
		this.pendingMessages.forEach(function(message){
			worker(message);
		});
	}
	
	this.workerHandler(worker);
};