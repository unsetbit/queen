var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition'),
	createWorker = require('../worker.js');

var create = module.exports = function(onEmitToSocket, workerConfig, options){
	precondition.checkDefined(workerConfig, "Worker config list required");

	var self = {
		emitter: new EventEmitter(),
		emitToSocket: onEmitToSocket,
		workerConfig: workerConfig,
		workerHandler: options.workerHandler || utils.noop,
		onDead: options.onDead || utils.noop
	};

	return getApi.call(self);
};

var getApi = function(){
	var api = broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));
	
	return api;
};

var kill = function(){
	this.emitToSocket({
		action: "kill"
	});

	this.workers.forEach(function(worker){
		worker.kill();
	});
	
	this.workers = void 0;
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var broadcast = function(event, data){
	this.emitToSocket({
		action: "broadcast",
		event: event,
		data: data
	});
};

var addWorker = function(id, attributes){
	var self = this,
		workerEmitter = new EventEmitter(),
		worker,
		onEmitToSocket;

	onEmitToSocket = function(event, data){
		self.emitToSocket({
			action: 'workerEvent',
			id: id,
			event: event,
			data: data
		});
	};

	worker = createWorker(id, attributes, workerEmitter, onEmitToSocket);

	this.workerEmitters[id] = workerEmitter;
	worker.on('dead', function(){
		var workerEmitter = self.workerEmitters[worker.id];
		if(workerEmitter !== void 0){
			delete self.workerEmitters[worker.id];
		}
	});

	this.workerHandler(worker);
};

var workerEventHandler = function(id, event, data){
	var workerEmitter = this.workerEmitters[id];
	if(workerEmitter !== void 0){
		workerEmitter.emit(event, data);
	}
}

var actionHandler = function(data){
	if(data.action === "workerEvent"){
		this.workerEventHandler(data.id, data.event, data.data);
	} else if(data.action === "addWorker"){
		this.addWorker(data.id, data.attributes);
	}
};
