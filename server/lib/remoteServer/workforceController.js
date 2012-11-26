var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

exports.create = function(id, workforce, port, host, eventsToListenFor){
	options = options || {};

	var workforce = new WorkforceController(id, workforce, port, host, eventsToListenFor);
	
	return workforce;
};

var WorkforceController = exports.WorkforceController = function(id, workforce, port, host, eventsToListenFor){
	this._workforce = workforce;
	this._id = id;
	this._port = port;
	this._host = host;
	this._eventsToListenFor = eventsToListenFor;
	this._emitter = new EventEmitter();
	this._workers = [];

	_.bindAll(this, "_newWorkerHandler");

	workforce.on("newWorker", this._newWorkerHandler);
};

WorkforceController.prototype._newWorkerHandler = function(worker){
	var self = this,
		workerId = worker.getId();
	
	this._workers[workerId] = worker;

	this._eventsToListenFor.forEach(function(eventName){
		worker.on(eventName, function(data){
			self._emit('workerEvent', {
				workerId: worker.getId(),
				event: eventName, 
				data: data
			});
		});
	});
};

WorkforceController.prototype.handleCommand = function(commandObject){
	switch(commandObject.command){
		case 'toWorker':
			this._workerEventHandler(commandObject.workerId, commandObject.event, commandObject.data);
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

WorkforceController.prototype._workerEventHandler = function(workerId, event, data){
	var worker = this._workers[workerId];
	
	if(worker === void 0) return;

	worker.emit(event, data);
};

WorkforceController.prototype.start = function(workerConfig, timeout){
	var workers = this._workforce.start(workerConfig, timeout),
		workerData = [];
	
	workers.forEach(function(worker){
		workerData.push({
			id: worker.getId(),
			attributes: worker.getAttributes()
		});
	});

	this._emit('workers', workerData);
};

WorkforceController.prototype._emit = function(event, data){
	var socket = net.connect(this._port, this._host),
		jsonObject = { remoteId: this._id, event: event, data: data},
		jsonString = JSON.stringify(jsonObject);

	socket.write(jsonString);
	socket.end();
};

// EVENT HANDLERS
WorkforceController.prototype.on = function(event, callback){
	this._emitter.on(event, callback);
};

WorkforceController.prototype.removeListener = function(event, callback){
	this._emitter.removeListener(event, callback);
};
