var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

exports.create = function(workforce, eventsToListenFor){
	var workforce = new ClientWorkforce(workforce, eventsToListenFor);
	
	return workforce;
};

var ClientWorkforce = exports.ClientWorkforce = function(workforce, eventsToListenFor){
	var self = this;
	this._workforce = workforce;
	this._eventsToListenFor = eventsToListenFor;
	this._emitter = new EventEmitter();
	this._workers = {};

	_.bindAll(this, "_workerAddedHandler");

	workforce.on("workerAdded", this._workerAddedHandler);
	workforce.on('dead', function(){
		self.kill();
	});
	workforce.on('start', function(){
		self._emit('start');
	});
	workforce.on('stopped', function(){
		self._emit('stopped');
	});
	workforce.on('workerDead', function(worker){
		self._emit('workerDead', {
			id: worker.getId()
		});
	});
};

ClientWorkforce.prototype.kill = function(){
	this._emitter.emit('dead');
	this._emitter.removeAllListeners();
	this._workforce = void 0;
};

ClientWorkforce.prototype._workerAddedHandler = function(worker){
	var self = this,
		workerId = worker.getId();
	
	this._workers[workerId] = worker;

	this._eventsToListenFor.forEach(function(event){
		worker.on(event, function(data){
			self._emit('workerEvent', {
				id: worker.getId(),
				event: event, 
				data: data
			});
		});
	});

	this._emit('workerAdded', {
		id: worker.getId(),
		attributes: worker.getAttributes()
	});
};

ClientWorkforce.prototype.handleEvent = function(event, data){
	switch(event){
		case 'workerEvent':
			this._workerEventHandler(data.id, data.event, data.data);
			break;
		case 'stop':
			this._workforce.stop();
			break;
		case 'kill':
			this._workforce.kill();
			break;
		default:
			console.log('unknown command!');
	}
};

ClientWorkforce.prototype._workerEventHandler = function(workerId, event, data){
	var worker = this._workers[workerId];
	
	if(worker === void 0){
		console.log('Worker not found');
		return;	
	}

	worker.emit(event, data);
};

ClientWorkforce.prototype.start = function(workerConfig, timeout){
	this._workforce.start(workerConfig, timeout);
};

ClientWorkforce.prototype._emit = function(event, data){
	this._emitter.emit('emit', {
		event: event,
		data: data
	});
};

// EVENT HANDLERS
ClientWorkforce.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

ClientWorkforce.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};
