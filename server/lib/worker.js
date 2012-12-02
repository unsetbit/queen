var	generateId = require('node-uuid').v4,
	precondition = require('precondition'),
	utils = require('./utils.js');
	
var create = module.exports = function(id, provider, emitter, onSendToSocket){
	precondition.checkDefined(emitter, "An emitter is required for workers");

	var self = {
		id: id,
		provider: provider,
		emitter: emitter,
		sendToSocket: onSendToSocket
	}

	self.kill = kill.bind(self);

	// When the worker is dead disable the kill function
	emitter.on('dead', function(){
		self.kill = utils.noop;
		emitter.removeAllListeners();
	});

	return getApi.call(self);
};

var getApi = function(){
	var api = this.sendToSocket;
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;

	Object.defineProperty(api, "id", { 
		value: this.id,
		enumerable: true 
	});

	Object.defineProperty(api, "provider", {
		value: this.provider,
		enumerable: true
	});

	return api;
};

var kill = function(){
	this.emitter.emit('dead');
};
