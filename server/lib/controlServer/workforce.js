var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var create = module.exports = function(minionMaster, workforceConfig, onEmitToSocket){
	precondition.checkDefined(minionMaster, "ControlServerWorkforce requires a minion master");
	precondition.checkDefined(workforceConfig, "ControlServerWorkforce requires a workforce config");
	precondition.checkType(typeof onEmitToSocket === "function", "ControlServerWorkforce requires an on emit to socket function");

	var self = {
		emitToSocket : onEmitToSocket,
		emitter: new EventEmitter(),
		workers: {}
	};
	
	self.handleWorkerEvent = handleWorkerEvent.bind(self);
	self.workforce =  minionMaster.getWorkforce(workforceConfig, self.workerHandler.bind(self));
	
	return getApi.call(self);
};

var getApi = function(){
	var api = actionHandler.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);

	return api;
}

var workerHandler = function(worker){
	var self = this;
	
	this.workers[worker.id] = worker;

	self.emitToSocket({
		action: 'addWorker',
		id: worker.id
	});

	worker.on('emit', function(data){
		self.emitToSocket({
			action: 'workerEvent',
			id: worker.id,
			event: data.event,
			data: data.data
		});
	});
};

var kill = function(){
	this.workforce.kill();
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();	
};

var handleWorkerEvent = function(id, event, data){
	var worker = this.workers[id];
	if(worker !== void 0){
		worker(event, data);
	}
}

var actionHandler = function(data){
	if(data.action === "workerEvent"){
		this.handleWorkerEvent(data.id, data.event, data.data);
	} else if(data.action === "broadcast"){
		this.workforce(data.event, data.data);
	} else if(data.action === "kill") {
		kill.call(this);
	}
};
