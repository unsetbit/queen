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

	var self = {
		socket: socket,
		minionMaster: minionMaster,
		log: options.logger,
		workforces: {}
	};

	self.kill = _.once(kill.bind(self));
	self.sendToSocket = sendToSocket.bind(self);
	self.workerProviderHandler = workerProviderHandler.bind(self)
	self.createWorkforce = createWorkforce.bind(self);
	socket.on('data', messageHandler.bind(self));
	socket.on('close', self.kill);
	socket.on('end', self.kill);
	socket.on('error', self.kill);
	minionMaster.workerProviders.forEach(self.workerProviderHandler)
	minionMaster.on('workerProvider', self.workerProviderHandler);
	socket.write('ready');
	
};

var kill = function(){
	this.sendToSocket = utils.noop;
	
	_.each(this.workforces, function(workforce){
		workforce.kill();
	});
	this.minionMaster.removeListener('workerProvider', this.workerProviderHandler);
};

var sendToSocket = function(message){
	this.socket.write(message);		
};

var workerProviderHandler = function(workerProvider){
	var self = this,
		onSendToSocket;

	onSendToSocket = function(message){
		message.workerProviderId = workerProvider.id;
		self.sendToSocket(message);
	};

	createWorkerProvider(onSendToSocket, workerProvider);

	this.socket.write({
		type: 'workerProvider',
		id: workerProvider.id,
		attributes: workerProvider.attributes,
		maxWorkerCount: workerProvider.maxWorkerCount,
		workerCount: workerProvider.workerCount
	});
};

var messageHandler = function(message){
	if(message.workforceId !== void 0){
		var workforce = this.workforces[message.workforceId];
		if(workforce !== void 0){
			workforce(message);
		} else {
			this.log("Workforce doesn't exist: " + JSON.stringify(message));
		}
	} else if (message.type === "spawnWorkforce"){
		this.createWorkforce(message.id, message.config);
	} else {
		this.log("Unknown action: " + JSON.stringify(message));
	}
};

var createWorkforce = function(remoteId, workforceConfig){
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