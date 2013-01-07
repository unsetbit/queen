var _ = require('../client/lib/underscore.js'),
	$ = require('./lib/jqueryModule.js'),
	EventEmitter = require('../client/lib/eventEmitter.js').EventEmitter,
	utils = require('../client/utils.js'),
	MESSAGE_TYPE = require('../protocol.js').WORKER_PROVIDER_MESSAGE_TYPE,
	template = require('./soy/WorkerProvider.soy.js');

var create = module.exports = function(config){
	var workerProvider = new WorkerProvider(config);
	return getApi(workerProvider);
};

function getApi(provider){
	var api = _.bind(provider.messageHandler, provider);
	api.on = _.bind(provider.emitter.on, provider.emitter);
	api.removeListener = _.bind(provider.emitter.removeListener, provider.emitter);
	api.kill = provider.kill;
	api.id = provider.id;
	api.attributes = provider.attributes;
	api.getElement = function(){
		return provider.element;
	}

	return api;
};

var WorkerProvider = function(config){
	this.emitter = new EventEmitter();
	this.id = config.id;
	this.attributes = config.attributes;
	this.workerCount = config.workerCount;
	this.maxWorkers = config.maxWorkers;
	this.isAvailable = config.isAvailable;
	this.isResponsive = config.isResponsive;

	this.kill = _.once(_.bind(this.kill, this));
	this.render();
};

WorkerProvider.prototype.kill = function(){
	var self = this;
	this.emitter.emit('dead');
	
	this.element.animate({
		width: "toggle"
	}, function(){
		self.element.remove();
	});
};

WorkerProvider.prototype.render = function(){
	var newElement = $(template.WorkerProvider({
		name: this.attributes.name || "Unknown",
		platform: this.attributes.os || "",
		family: this.attributes.family || "",
		majorVersion: this.attributes.version.major || 0,
		workerCount: this.workerCount,
		unavailable: this.isAvailable !== true,
		unresponsive: this.isResponsive !== true
	}));

	if(this.element){
		this.element[0].innerHTML = newElement[0].innerHTML;

	} else {
		this.element = newElement;
	}
};

WorkerProvider.prototype.messageHandler = function(message){
	switch(message[0]){
		case MESSAGE_TYPE['dead']:
			this.kill();
		break;
		case MESSAGE_TYPE['unresponsive']:
			this.unresponsive();
		break;
		case MESSAGE_TYPE['responsive']:
			this.responsive();
		break;
		case MESSAGE_TYPE['worker spawned']:
			this.newWorker();
		break;
		case MESSAGE_TYPE['worker dead']:
			this.workerDead();
		break;
		case MESSAGE_TYPE['available']:
			this.available();
		break;
		case MESSAGE_TYPE['unavailable']:
			this.unavailable();
		break;
	}
};

WorkerProvider.prototype.newWorker = function(){
	this.workerCount++;
	this.render();
	this.emitter.emit('newWorker');
};

WorkerProvider.prototype.workerDead = function(){
	this.workerCount--;
	this.render();
	this.emitter.emit('workerDead');
};

WorkerProvider.prototype.available = function(){
	this.isAvailable = true;
	this.render();
	this.emitter.emit('available');
};

WorkerProvider.prototype.unavailable = function(){
	this.isAvailable = false;
	this.render();
	this.emitter.emit('unavailable');
};

WorkerProvider.prototype.responsive = function(){
	this.isResponsive = true;
	this.render();
	this.emitter.emit('responsive');
};

WorkerProvider.prototype.unresponsive = function(){
	this.isResponsive = false;
	this.render();
	this.emitter.emit('unresponsive');
};
