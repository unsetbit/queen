var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	utils = require('./utils.js'),
	precondition = require('precondition');

var create = exports.create = function(workerConfig, options){
	var workforce = new Workforce(workerConfig);
	options = options || {};
	if(options.stopHandler)	workforce.stopHandler = options.stopHandler;
	if(options.workerHandler) workforce.workerHandler = options.workerHandler;
	if(options.providerFilter) workforce.providerFilter = options.providerFilter;
	if(options.killOnStop !== void 0) workforce.killOnStop = options.killOnStop;

	return workforce;
};

var Workforce = exports.Workforce = function(workerConfig){
	precondition.checkDefined(workerConfig, "Worker config object must be defined");

	var self = this;
	this.emitter = new EventEmitter();
	this.workers = [];
	this.workerConfig = workerConfig;
	this.pendingWorkers = 0;

	this.kill = _.once(this.kill.bind(this));
	this.api = Object.freeze(getApi(this));
};

var getApi = function(workforce){
	var api = workforce.broadcast.bind(workforce);
	api.on = workforce.emitter.on.bind(workforce.emitter);
	api.removeListener = workforce.emitter.removeListener.bind(this.emitter);
	api.kill = workforce.kill;
	api.start = workforce.start.bind(workforce);
	api.stop = workforce.stop.bind(workforce);
	api.populate = workforce.populate.bind(workforce);
	
	return api;
};

Workforce.prototype.workerHandler = utils.noop;
Workforce.prototype.stopHandler = utils.noop;
Workforce.prototype.providerFilter = function(){return true;};
Workforce.prototype.killOnStop = true;
Workforce.prototype.started = false;

Workforce.prototype.start = function(){
	if(this.started) return;
	this.started = true;
	this.emitter.emit('start');
};

Workforce.prototype.populate = function(workerProviders){
	var self = this;

	if(!_.isArray(workerProviders)) workerProviders = [workerProviders];
	if(workerProviders.length === 0) return;

	workerProviders = workerProviders.filter(this.providerFilter);

	this.pendingWorkers += workerProviders.length;
	workerProviders.forEach(function(workerProvider){
		workerProvider(self.workerConfig, function(worker){
			self.pendingWorkers--;
			if(worker !== void 0){
				self.addWorker(worker);
			}
		});
	});

	if(this.pendingWorkers === 0 && self.workers.length === 0){
		this.signalStop();
	}
};

Workforce.prototype.signalStop = function(){
	this.stopHandler();

	if(this.killOnStop){
		this.kill();
	}
};

Workforce.prototype.stop = function(){
	this.workers.concat([]).forEach(function(worker){
		worker.kill();
	});
};

Workforce.prototype.kill = function(){
	this.workers.concat([]).forEach(function(worker){
		worker.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

Workforce.prototype.broadcast = function(message){
	this.workers.forEach(function(worker){
		worker(message);
	});
};

Workforce.prototype.addWorker = function(worker){
	precondition.checkType(typeof worker == "function", "Worker expected to be a function");
	var self = this;

	this.workers.push(worker);
	worker.on('dead', function(){
		self.workers.splice(self.workers.indexOf(worker), 1);

		if(self.pendingWorkers === 0 && self.workers.length === 0){
			self.signalStop();
		}
	});

	worker.on('message', function(message){
		self.emitter.emit('message', message, worker);
	});

	this.workerHandler(worker);
	this.emitter.emit("worker", worker);
};