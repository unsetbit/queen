var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	precondition = require('precondition'),
	createWorker = require('../worker.js');

var utils = require('../utils.js');

var create = module.exports = function(getWorkerProvider, socket, onSendToSocket, workerConfig){
	precondition.checkType(typeof getWorkerProvider === "function", "getWorkerProvider function required");
	precondition.checkDefined(socket, "Socket required");
	precondition.checkType(typeof onSendToSocket === "function", "Emit to socket function required");
	precondition.checkDefined(workerConfig, "Worker config required");

	var self = {
		emitter: new EventEmitter(),
		sendToSocket: onSendToSocket,
		workerConfig: workerConfig,
		workerHandler: workerConfig.handler || utils.noop,
		doneHandler: workerConfig.done || utils.noop,
		getWorkerProvider: getWorkerProvider,
		workerEmitters: {}
	};

	self.kill = _.once(kill.bind(self));
	self.addWorkerHandler = addWorkerHandler.bind(self);
	self.workerMessageHandler = workerMessageHandler.bind(self);

	socket.on('message', messageHandler.bind(self));
	
	return getApi.call(self);
};

var getApi = function(){
	var api = broadcast.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	
	return api;
};

var messageHandler = function(message){
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

var kill = function(){
	this.sendToSocket({type:"kill"});

	_.each(this.workerEmitters, function(workerEmitter){
		workerEmitter.emit('dead');
	});
	
	this.workers = void 0;
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var broadcast = function(message){
	this.sendToSocket({
		type: "broadcast",
		message: message
	});
};

var addWorkerHandler = function(message){
	var self = this,
		workerId = message.id,
		workerProvider = this.getWorkerProvider(message.providerId),
		workerEmitter = new EventEmitter(),
		worker,
		onEmitToSocket;

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

var workerMessageHandler = function(message){
	var workerEmitter = this.workerEmitters[message.id];
	if(workerEmitter !== void 0){
		workerEmitter.emit('message', message.message);
	}
}
