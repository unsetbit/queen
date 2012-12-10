var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var utils = require('../utils.js');

var create = module.exports = function(queen, workerConfig, onSendToSocket){
	precondition.checkDefined(queen, "ControlServerWorkforce requires a queen");
	precondition.checkDefined(workerConfig, "ControlServerWorkforce requires a worker config");
	precondition.checkType(typeof onSendToSocket === "function", "ControlServerWorkforce requires an on send to socket function");

	var workforce = new Workforce(queen, workerConfig, onSendToSocket);

	return workforce.api;
};

var Workforce = function(queen, workerConfig, onSendToSocket){
	this.sendToSocket = onSendToSocket;

	workerConfig.handler = this.workerHandler.bind(this);
	workerConfig.stop = this.stopHandler.bind(this);
	this.workers = {};
	this.emitter = new EventEmitter();
	this.queen = queen;
	this.workforce = queen(workerConfig);

	this.kill = _.once(this.kill.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

Workforce.prototype.log = utils.noop;

var getApi = function(){
	var api = this.messageHandler.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;

	return api;
}

Workforce.prototype.stopHandler = function(){
	this.sendToSocket({type: "stop"});
};

Workforce.prototype.workerHandler = function(worker){
	var self = this;
	this.workers[worker.id] = worker;

	self.sendToSocket({
		type: 'addWorker',
		id: worker.id,
		providerId: worker.provider.id
	});

	worker.on('message', function(message){
		self.sendToSocket({
			type: 'workerMessage',
			id: worker.id,
			message: message
		});
	});
};

Workforce.prototype.kill = function(){
	this.sendToSocket = utils.noop;
	this.workforce.kill();
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();	
};

Workforce.prototype.workerMessageHandler = function(message){
	var worker = this.workers[message.id];
	if(worker !== void 0){
		worker(message.message);
	}
};

Workforce.prototype.populateHandler = function(message){
	var self = this,
		providers = message.providerIds.map(function(id){
			return self.queen.getWorkerProvider(id);
		}).filter(function(provider){
			return provider !== void 0;
		});

	this.workforce.populate(providers);
};

Workforce.prototype.messageHandler = function(message){
	switch(message.type){
		case "workerMessage":
			this.workerMessageHandler(message);
			break;
		case "broadcast":
			this.workforce(message.message);
			break;
		case "kill":
			this.kill();
			break;
		case "populate":
			this.populateHandler(message);
			break;
	}
};
