var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var utils = require('../utils'),
	createClientWorkforce = require('./workforce.js'),
	createWorkerProvider = require('./workerProvider.js');

var create = module.exports = function(socket, minionMaster, options){
	precondition.checkDefined(socket, "Client requires a socket");
	precondition.checkDefined(minionMaster, "Client requires a minion master instance");

	var client = new Client(socket, minionMaster);

	options = options || {};
	if(options.logger) client.log = options.logger;

	return client;
};

var Client = function(socket, minionMaster){
	this.socket = socket;
	this.minionMaster = minionMaster;
	this.workforces = {};
	this.workerProviders = {};

	socket.on('data', this.messageHandler.bind(this));
	
	this.workerProviderHandler = this.workerProviderHandler.bind(this);
	minionMaster.workerProviders.forEach(this.workerProviderHandler)
	minionMaster.on('workerProvider', this.workerProviderHandler);

	this.kill = this.kill.bind(this);
	socket.on('close', this.kill);
	socket.on('end', this.kill);
	socket.on('error', this.kill);
	this.sendToSocket('ready');
};

Client.prototype.log = utils.noop;
Client.prototype.isTrackingWorkerProviders = false;

Client.prototype.kill = function(){
	this.sendToSocket = utils.noop;
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});

	_.each(this.workerProviders, function(workerProvider){
		workerProvider.kill();
	});

	this.minionMaster.removeListener('workerProvider', this.workerProviderHandler);
};

Client.prototype.sendToSocket = function(message){
	this.socket.write(message);		
};

Client.prototype.workerProviderHandler = function(workerProvider){
	var self = this,
		onSendToSocket;

	onSendToSocket = function(message){
		if(self.isTrackingWorkerProviders){
			message.workerProviderId = workerProvider.id;
			self.sendToSocket(message);
		}
	};

	var clientWorkerProvider = createWorkerProvider(workerProvider, onSendToSocket);
	this.workerProviders[workerProvider.id] = clientWorkerProvider;
	clientWorkerProvider.on('dead', function(){
		self.workerProviders[workerProvider.id].kill();
		delete self.workerProviders[workerProvider.id];
	});

	this.sendToSocket({
		type: 'workerProvider',
		id: workerProvider.id,
		attributes: workerProvider.attributes
	});
};

Client.prototype.messageHandler = function(message){
	if(message.workforceId !== void 0){
		var workforce = this.workforces[message.workforceId];
		if(workforce !== void 0){
			workforce(message);
		} else {
			this.log("Workforce doesn't exist: " + JSON.stringify(message));
		}
	} else if (message.type === "spawnWorkforce"){
		this.createWorkforce(message.id, message.config);
	} else if (message.type === "trackWorkerProviders"){
		this.isTrackingWorkerProviders = message.value === true;
	} else {
		this.log("Unknown action: " + JSON.stringify(message));
	}
};

Client.prototype.createWorkforce = function(remoteId, workforceConfig){
	var self = this,
		workforce,
		onEmitToSocket;
	
	onSendToSocket = function(message){
		message.workforceId = remoteId;
		self.sendToSocket(message);
	};

	workforce = createClientWorkforce(this.minionMaster, workforceConfig, onSendToSocket);

	this.workforces[remoteId] = workforce;
	workforce.on('dead', function(){
		delete self.workforces[remoteId];
	});
};