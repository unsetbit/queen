var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var utils = require('../utils.js');

var create = module.exports = function(minionMaster, workforceConfig, onSendToSocket){
	precondition.checkDefined(minionMaster, "ControlServerWorkforce requires a minion master");
	precondition.checkDefined(workforceConfig, "ControlServerWorkforce requires a workforce config");
	precondition.checkType(typeof onSendToSocket === "function", "ControlServerWorkforce requires an on send to socket function");

	var self = {
		sendToSocket : onSendToSocket,
		emitter: new EventEmitter(),
		workers: {}
	};
	
	self.kill = _.once(kill.bind(self));
	workforceConfig.handler = workerHandler.bind(self);
	workforceConfig.done = doneHandler.bind(self);

	self.workerMessageHandler = workerMessageHandler.bind(self);
	self.workforce =  minionMaster(workforceConfig);
	
	return getApi.call(self);
};

var getApi = function(){
	var api = messageHandler.bind(this);
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;

	return api;
}

var doneHandler = function(){
	this.sendToSocket({type: "done"});
};

var workerHandler = function(worker){
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

var kill = function(){
	this.sendToSocket = utils.noop;
	this.workforce.kill();
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();	
};

var workerMessageHandler = function(message){
	var worker = this.workers[message.id];
	if(worker !== void 0){
		worker(message.message);
	}
}

var messageHandler = function(message){
	if(message.type === "workerMessage"){
		this.workerMessageHandler(message);
	} else if(message.type === "broadcast"){
		this.workforce(message.message);
	} else if(message.type === "kill"){
		this.kill();
	}
};
