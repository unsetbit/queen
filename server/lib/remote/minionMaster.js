var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	jot = require('json-over-tcp'),
	precondition = require('precondition');

var createWorkforce = require('./workforce.js').create,
	utils = require('../../utils.js');
	
var create = module.exports = function(options){
	options = options || {};

	var self = {
		socket: options.socket || new jot.Socket(),
		log: options.logger || utils.noop,
		emitter: new EventEmitter(),
		workforces: {}
	}
	
	self.socket.on('data', dataHandler.bind(self));
	self.socket.connect(options.port || 8099, options.hostname || "localhost");

	return getApi.call(self);
};

var getApi = function(){
	var api = getWorkforce.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = _.once(kill.bind(this));

	return api;
};

var kill = function(){
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var dataHandler = function(data){
	var workforce,
		workforceId = data.workforceId;

	if(workforceId !== void 0){
		workforce = this.workforces[workforceId];
		if(workforce === void 0){
			this.log('Data handler error, no workforce found' + JSON.stringify(data));
			return;
		}
		workforce(data);
	} else if(data.action === "workerProvider"){
		this.emitter.emit('workerProvider');
	}
};

var getWorkforce = function(workerConfig, workerHandler){
	var self = this,
		workforceId = generateId(),
		workforceEmitter = new EventEmitter(),
		workforce,
		onEmitToSocket,
		onDead;

	onEmitToSocket = function(data){
		data.workforceId = workforceId;
		this.socket.write(data);
	};


	workforce = createWorkforce(onEmitToSocket, workerConfig, {
		workerHandler: workerHandler
	});

	workforce.on('dead', function(){
		delete self.workforceEmitters[workforceId];
	});

	this.workforceEmitters[workforceId] = workforceEmitter;

	this.socket.write({
		action: 'spawnWorkforce', 
		id: workforceId,
		config: workerConfig
	});

	this.log('New workforce');
	this.emitter.emit('workforce', workforce);

	return workforce;
};