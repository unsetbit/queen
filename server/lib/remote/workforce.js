var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition'),
	createWorker = require('../worker.js');

var utils = require('../utils.js');

var Workforce = exports.Workforce = function(getWorkerProvider, socket, onSendToSocket){
	this.socket = socket;
	this.getWorkerProvider = getWorkerProvider;
	this.sendToSocket = onSendToSocket;
	this.emitter = new EventEmitter();
	this.workerEmitters = {};
	
	this.kill = _.once(this.kill.bind(this));

	socket.on('message', this.messageHandler.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

Workforce.prototype.workerHandler = utils.noop;
Workforce.prototype.doneHandler = utils.noop;

var getApi = function(){
	var api = this.broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	
	return api;
};

Workforce.prototype.messageHandler = function(message){
	switch(message.type){
		case "workerMessage":
			this.workerMessageHandler(message);
			return;
		case "addWorker":
			this.addWorkerHandler(message);
			return;
		case "done":
			this.doneHandler();
			this.kill();
			return;
	}
};

Workforce.prototype.kill = function(){
	this.sendToSocket({type:"kill"});

	_.each(this.workerEmitters, function(workerEmitter){
		workerEmitter.emit('dead');
	});
	
	this.workers = void 0;
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

Workforce.prototype.broadcast = function(message){
	this.sendToSocket({
		type: "broadcast",
		message: message
	});
};

Workforce.prototype.addWorkerHandler = function(message){
	var self = this,
		workerId = message.id,
		workerProvider = this.getWorkerProvider(message.providerId),
		workerEmitter = new EventEmitter(),
		worker,
		onEmitToSocket;

	console.log("Worker: " + workerId + " " + workerProvider.attributes.name);
	
	onSendToSocket = function(message){
		self.sendToSocket({
			type: 'workerMessage',
			id: workerId,
			message: message
		});
	};

	worker = createWorker(workerId, workerProvider, workerEmitter, onSendToSocket);

	this.workerEmitters[workerId] = workerEmitter;
	worker.on('dead', function(){
		var workerEmitter = self.workerEmitters[workerId];
		if(workerEmitter !== void 0){
			delete self.workerEmitters[workerId];
		}
	});

	worker.on('message', function(message){
		self.emitter.emit('message', message, worker);
	});

	this.workerHandler(worker);
};

Workforce.prototype.workerMessageHandler = function(message){
	var workerEmitter = this.workerEmitters[message.id];
	if(workerEmitter !== void 0){
		workerEmitter.emit('message', message.message);
	}
}
