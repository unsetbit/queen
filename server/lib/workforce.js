var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	uuid = require('node-uuid')
	precondition = require('precondition');

var	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = create = function(options){
	options = options || {};
	
	var workforce = new Workforce();

	if(options.logger){
		workforce.setLogger(options.logger);
	}

	return workforce;
};

exports.Workforce = Workforce = function(){
	this._id = uuid.v4();
	this._emitter = new EventEmitter();
	
	this._workers = {};
	this._runningWorkers = 0;
	this._started = false;
	this._isDone = false;
};

Workforce.prototype.getId = function(){
	return this._id;
};

Workforce.prototype.isRunning = function(){
	return this._runningWorkers > 0;
};

Workforce.prototype.start = function(workerConfig, timeout){
	var self = this,
		timer;

	if(this._started) return;
	this._started = true;

	if(timeout){
		timer = setTimeout(function(){
			_.each(self._workers, function(worker){
				worker.echo("timeout");
			});

			self.stop();
		}, timeout);

		this.on('stopped', function(){
			clearTimeout(timer);
		});
	}

	this._emit("start", {
		timeout: timeout,
		workerConfig: workerConfig
	});

	return;
};

Workforce.prototype.stop = function(){
	this._emit("stop");	// stopped event fires once all workers have stopped

	if(this._runningWorkers === 0){
		this._emit('stopped');
	} else {
		_.each(this._workers, function(worker){
			worker.kill();
		});
	}
};

Workforce.prototype.kill = function(){
	if(this._isDead) return;
	this._isDead = true;
	
	this.stop();
	this._emit("dead");
	this._emitter.removeAllListeners();
	this._workerProviders = [];
	this._workers = {};
};

Workforce.prototype._getWorkers = function(){
	return _.values(this._workers);
};

Workforce.prototype.addWorker = function(worker){
	var self = this;
	var workerId = worker.getId();
	if(this._workers[workerId] !== void 0){
		return; // worker exists
	}

	this._workers[workerId] = worker;
	
	worker.on("dead", function(){
		self._removeWorker(worker);
	});

	this._runningWorkers += 1;
	if(this._runningWorkers === 1){
		this._emit("running");
	}

	this._emit("workerAdded", worker);
};

Workforce.prototype._removeWorker = function(worker){
	var workerId = worker.getId(),
		worker = this._workers[workerId];
	
	if(worker === void 0){
		return;
	}

	delete this._workers[workerId];
	this._emit('workerDead', worker);

	this._runningWorkers -= 1;
	if(this._runningWorkers === 0){
		this._emit('stopped');
	}
};

// Events
Workforce.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
	return this;
};

Workforce.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
	return this;
};

Workforce.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

// Logging
Workforce.prototype.eventsToLog = [
	["info", "start", "Start"],
	["info", "stop", "Stopping"],
	["info", "stopped", "Stopped"],
	["debug", "dead", "Dead"],
	["debug", "workerAdded", "Worker added"],
	["debug", "workerDead", "Worker dead"]
];

Workforce.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[Workforce-" + this.getId().substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
	};
};