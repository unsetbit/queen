var workerFactory = require('./IframeWorker.js').create;
var io = require('./lib/socket.io.js');
var _ = require('./lib/underscore.js');

exports.create = function(options){
	var options = options || {},
		env = options.env || window,
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath, {
			'max reconnection attempts': Infinity
		});


	var self = {
		log: options.logger,
		socket: socket,
		sendToSocket: sendToSocket,
		workerFactory: workerFactory,
		connectionHandler: connectionHandler,
		disconnectionHandler: disconnectionHandler,
		destroyWorkers: destroyWorkers,
		register: register,
		workers: {},
		workerMessageHandler: workerMessageHandler,
		spawnWorkerHandler: spawnWorkerHandler,
		messageHandler: messageHandler,
		killWorkerHandler: killWorkerHandler,
		kill: kill,
		workerCount: 0,
		maxWorkerCount: 1000,
		maxTimeout: 1000 * 60
	};
	window.minionSelf = self;
	_.bindAll(self);

	socket.on("connect", self.connectionHandler);
	socket.on("message", self.messageHandler);
	socket.on("disconnect", self.disconnectionHandler);

	return getApi.call(self);
};

var getApi = function(){
	var api = {};

	api.getWorkerSocket = getWorkerSocket.bind(this);
	window.GetWorkerSocket = api.getWorkerSocket;

	return api;
};

var kill = function(){
	this.destroyWorkers();

	this.socket.removeListener("connect", this.connectionHandler);
	this.socket.removeListener("message", this.messageHandler);
	this.socket.removeListener("disconnect", this.disconnectionHandler);
	
	this.socket = void 0;
};

var sendToSocket = function(message){
	this.socket.send(JSON.stringify(message));
};

var getWorkerSocket = function(workerId){
	var worker = this.workers[workerId];
	return worker;
};

var connectionHandler = function(){
	this.log('Connected');
	if(this.isReconnecting){
		window.location.reload(true); // Reload on reconnect
	} else {
		this.register();
	}
};

var messageHandler = function(message){
	message = JSON.parse(message);
	switch(message.type){
		case "workerMessage":
			this.workerMessageHandler(message);
			break;
		case "spawnWorker":
			this.spawnWorkerHandler(message);
			break;
		case "killWorker":
			this.killWorkerHandler(message);
	}
};

var workerMessageHandler = function(message){
	var workerId = message.id,
		message = message.message;

	var worker = this.workers[workerId];
	if(worker === void 0){ // No longer listening to this worker
		return;
	};

	worker.onmessage(message);
};

var spawnWorkerHandler = function(message){
	this.log('Spawning Worker');

	var self = this,
		workerId = message.id,
		workerConfig = message.config,
		timeout = workerConfig.timeout,
		worker,
		workerTimeout;

	if(this.workerCount > this.maxWorkerCount){
		return;
	}
	
	this.workerCount += 1;
	if(this.workerCount === this.maxWorkerCount){
		return;
	}

	var onSendToSocket = function(message){
		self.sendToSocket({
			type: "workerMessage",
			id: workerId,
			message: message
		});
	};

	worker = this.workerFactory(workerId, onSendToSocket, {
		onDead: function(){
			if(workerConfig.timeout){
				clearTimeout(workerTimeout);
			}

			delete self.workers[workerId];

			self.workerCount -= 1;
			self.sendToSocket({
				type: "workerDead",
				id: workerId
			})
		}
	});

	if(workerConfig.timeout){
		workerTimeout = setTimeout(function(){
			worker.kill();
		}, workerConfig.timeout);
	}
	
	this.workers[workerId] = worker;
	
	worker.start(workerConfig);
	
	return worker;
};

var killWorkerHandler = function(message){
	var worker = this.workers[message.id];
	if(worker === void 0) return;
	worker.kill();
};

var disconnectionHandler = function(){
	this.log('Disconnected');
	this.destroyWorkers();
	this.isReconnecting = true;
};

var destroyWorkers = function(){
	_.each(this.workers, function(worker){
		worker.kill();
	});

	this.workers = {};	
	this.workerCount = 0;
};

var register = function(){
	var attributes = {},
		capabilities = {};

	attributes.userAgent = navigator.userAgent;

	// fill up capabilities
	_.each(Modernizr, function(value, key){
		if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
			capabilities[key] = value;
		}
	});

	attributes.capabilities = capabilities;
	this.sendToSocket({
		type: "register",
		attributes: attributes
	});
};