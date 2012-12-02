var _ = require("underscore"),
	EventEmitter = require("events").EventEmitter,
	net = require('net'),
	precondition = require('precondition');

var createWorkforce = require('./workforce.js').create;

var create = module.exports = function(socket, minionMaster, options){
	precondition.checkDefined(socket, "Client requires a socket");
	precondition.checkDefined(minionMaster, "Client requires a minion master instance");

	var self = {
		socket: socket,
		minionMaster: minionMaster,
		log: options.logger,
		workforces: {}
	}

	socket.on('data', dataHandler.bind(self));
	minionMaster.on('workerProvider', workerProviderHandler.bind(self));

	return getApi.call(self);
};

var getApi = function(){
	var api = {};
	return api;
};

var workerProviderHandler = function(workerProvider){
	this.socket.write({
		action: 'workerProvider',
		attributes: workerProvider.attributes
	});
};

var dataHandler = function(data){
	if(data.action === "spawnWorkforce"){
		this.createWorkforce(data.id, data.config);
	}else if(data.workforceId !== void 0){
		var workforce = this.workforces[data.workforceId];
		if(workforce !== void 0){
			workforce(data);
		} else {
			this.log("Workforce no longer exists: " + JSON.stringify(data));
		}
	} else {
		this.log("Unknown action: " + JSON.stringify(data));
	}
};

var createWorkforce = function(remoteId, workforceConfig){
	var self = this,
		workforce,
		onEmitToSocket;
	
	onEmitToSocket = function(data){
		data.workforceId = remoteId;
		self.socket.write(data);
	};

	workforce = createClientWorkforce(this.minionMaster, workforceConfig, onEmitToSocket);

	this.workforces[remoteId] = workforce;
	workforce.on('dead', function(){
		delete self.workforces[remoteId];
	});
};