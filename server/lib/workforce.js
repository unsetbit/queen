var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	uuid = require('node-uuid')
	precondition = require('precondition');

var	logEvents = require("./utils.js").logEvents,
	stopLoggingEvents = require("./utils.js").stopLoggingEvents;

exports.create = create = function(workerProviders, context, options){
	var options = options || {},
		timeout = options.timeout,
		workforce = new Workforce(workerProviders, context, timeout);

	if(options.logger){
		workforce.setLogger(options.logger);
	}

	return workforce;
};

exports.Workforce = Workforce = function(workerProviders, context, timeout){
	precondition.checkDefined(workerProviders, "Worker Providers must be defined");
	precondition.checkDefined(context, "A context must be defined");

	this._id = uuid.v4();
	this._emitter = new EventEmitter();
	
	this._context = context;
	this._timeout = timeout;

	this._workerProviders = workerProviders;
	this._workerSockets = {};
	this._runningSockets = 0;
	this._started = false;
};

Workforce.prototype.getId = function(){
	return this._id;
};

Workforce.prototype._startWorker = function(workerProvider){
	var workerSocket = workerProvider.spawnWorker(this._context, this._timeout);

	this._addWorkerSocket(workerSocket);
	this._emit("workerStarted", {
		provider: workerProvider,
		socket: workerSocket
	});
};

Workforce.prototype.isRunning = function(){
	return this._runningSockets > 0;
};

Workforce.prototype.start = function(){
	var self = this;

	if(this._started) return;
	this._started = true;

	this._workerProviders.forEach(function(workerProvider){
		self._startWorker(workerProvider);
	});

	if(this._timeout){
		setTimeout(function(){
			_.each(this._workerSockets, function(workerSocket){
				workerSocket.echo("timeout");
			});
			self.stop();
		}, this._timeout);
	}

	this._emit("started");
};

Workforce.prototype.stop = function(){
	this._emit("stopping");
	_.each(this._workerSockets, function(workerSocket){
		workerSocket.kill();
	});

	// stopped event fires once all workers have stopped
};

Workforce.prototype.kill = function(){
	this.stop();
	this._emit("dead");
	this._workerProviders = [];
	this._workerSockets = {};
};

Workforce.prototype._addWorkerSocket = function(workerSocket){
	var self = this;
	var workerSocketId = workerSocket.getId();
	
	this._workerSockets[workerSocketId] = workerSocket;
	
	workerSocket.on("dead", function(){
		self._removeWorkerSocket(workerSocketId);
	});

	this._runningSockets += 1;
	if(this._runningSockets === 1){
		this._emit("running");
	}
};

Workforce.prototype._removeWorkerSocket = function(workerSocketId){
	if(this._workerSockets[workerSocketId] === void 0){
		return;
	}

	delete this._workerSockets[workerSocketId];

	this._runningSockets -= 1;
	if(this._runningSockets === 0){
		this._emit("stopped");
		this.kill();
	}
};

// Events
Workforce.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

Workforce.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};

Workforce.prototype._emit = function(event, data){
	this._emitter.emit(event, data);
};

// Logging
Workforce.prototype.eventsToLog = [
	["info", "started", "Started"],
	["info", "stop", "Stopping"],
	["debug", "dead", "Dead"],
	["debug", "stopped", "Stopped"],
	["debug", "workerStarted", "Worker started"]
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