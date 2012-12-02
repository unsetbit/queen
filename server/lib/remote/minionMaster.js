var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	jot = require('json-over-tcp'),
	generateId = require('node-uuid').v4,
	precondition = require('precondition');

var createWorkforce = require('./workforce.js'),
	createWorkerProvider = require('./workerProvider.js'),
	utils = require('../utils.js');
	
var create = module.exports = function(callback, options){
	options = options || {};

	var self = {
		socket: options.socket || new jot.Socket(),
		log: options.logger || utils.noop,
		emitter: new EventEmitter(),
		isTrackingWorkerProviders: options.trackWorkerProviders === true,
		workforceEmitters: {},
		workerProviders: {},
		workerProviderEmitters: {}
	};

	self.getWorkerProvider = getWorkerProvider.bind(self);
	self.workerProviderHandler = workerProviderHandler.bind(self);

	self.onReady = function(){
		callback(getApi.call(self));
	};

	self.socket.on('data', messageHandler.bind(self));
	self.socket.connect(options.port || 8099, options.hostname || "localhost");
};

var getApi = function(){
	var self = this,
		api = getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));
	
	Object.defineProperty(api, 'workerProviders', {
		enumerable: true,
		get: function(){
			return _.values(self.workerProviders);
		}
	});

	return api;
};

var kill = function(){
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var messageHandler = function(message){
	var workforceEmitter,
		workerProviderEmitter;
	
	if(message.workforceId !== void 0){
		workforceEmitter = this.workforceEmitters[message.workforceId];
		if(workforceEmitter === void 0){
			//this.log('Data handler error, no workforce found' + JSON.stringify(message));
			return;
		}
		workforceEmitter.emit('message', message);
	} else if(message.type === "workerProvider"){
		this.workerProviderHandler(message);
	} else if(message.workerProviderId !== void 0){
		var workerProviderEmitter = this.workerProviderEmitters[message.workerProviderId];
		workerProviderEmitter.emit("message", message);
	} else if(message === "ready"){
		this.onReady();
	};
};

var getWorkerProvider = function(id){
	return this.workerProviders[id];
};

var workerProviderHandler = function(message){
	var	self = this, 
		id = message.id,
		workerProviderEmitter = new EventEmitter(),
		attributes = message.attributes,
		maxWorkerCount = message.maxWorkerCount,
		workerCount= message.workerCount,
		workerProvider = createWorkerProvider(workerProviderEmitter, attributes, maxWorkerCount, workerCount);

	this.workerProviderEmitters[id] = workerProviderEmitter;
	this.workerProviders[id] = workerProvider;

	workerProvider.on('dead', function(){
		delete self.workerProviderEmitters[id];
		delete self.workerProviders[id];
	});

	this.emitter.emit('workerProvider', workerProvider);
};

var getWorkforce = function(workerConfig){
	var self = this,
		workforceId = generateId(),
		workforceEmitter = new EventEmitter(),
		workforce,
		onEmitToSocket,
		onDead;

	onSendToSocket = function(message){
		message.workforceId = workforceId;
		self.socket.write(message);
	};

	workforce = createWorkforce(self.getWorkerProvider, workforceEmitter, onSendToSocket, workerConfig);

	workforce.on('dead', function(){
		self.log('Workforce dead');
		delete self.workforceEmitters[workforceId];
	});

	this.workforceEmitters[workforceId] = workforceEmitter;

	this.socket.write({
		type: 'spawnWorkforce', 
		id: workforceId,
		config: workerConfig
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce);

	return workforce;
};