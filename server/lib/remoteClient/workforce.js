var	uuid = require('node-uuid'),
	_ = require('underscore'),
	EventEmitter = require('events').EventEmitter,
	Workforce = require('../workforce.js').Workforce;

var createWorker = require('./worker.js').create;

exports.create = function(workerFilters, options){
	options = options || {};

	var workforce = new RemoteWorkforce(workerFilters);

	// If logger exists, attach to it
	if(options.logger){
		workforce.setLogger(options.logger);
	}

	return workforce;
};

var RemoteWorkforce = exports.RemoteWorkforce = function(workerFilters){
	Workforce.apply(this);

	this._internalEmitter = new EventEmitter();
	this._workerFilters = workerFilters;
	
	_.bindAll(this, "_workerAddedHandler", "_workerEventHandler");
	this._internalEmitter.on('workerAdded', this._workerAddedHandler);
	this._internalEmitter.on('workerEvent', this._workerEventHandler);
};
RemoteWorkforce.prototype = Object.create(Workforce.prototype);

RemoteWorkforce.prototype.start = function(workerConfig, timeout, eventsToListenFor){
	this._emitToSocket('start', {
		workerConfig: workerConfig,
		timeout: timeout,
		eventsToListenFor: eventsToListenFor,
		workerFilters: this._workerFilters
	});
};

RemoteWorkforce.prototype.handleEvent = function(event, data){
	this._internalEmitter.emit(event, data);
};

RemoteWorkforce.prototype._workerAddedHandler = function(workerConfig){
	var self = this,
		workerId = workerConfig.id,
		worker = createWorker(workerId, workerConfig.attributes);
	
	worker.on('emit', function(data){
		self._emitToSocket('workerEvent',{
			id: workerId,
			event: data.event,
			data: data.data
		});
	});
	
	this.addWorker(worker);
};

RemoteWorkforce.prototype._workerEventHandler = function(workerEventData){
	var workerId = workerEventData.id,
		event = workerEventData.event,
		data = workerEventData.data,
		worker;

	if(workerId === void 0){
		return;
	}

	worker = this._workers[workerId];
	if(worker === void 0){
		return;
	}

	worker.echo(event, data);
};

RemoteWorkforce.prototype._emitToSocket = function(event, data){
	this._emitter.emit('emit', {
		event: event,
		data: data
	});
};
