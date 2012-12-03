var createWebWorker = require('./WebWorker.js').create,
	createIframeWorker = require('./IframeWorker.js').create,
	io = require('./lib/socket.io.js'),
	_ = require('./lib/underscore.js'),
	utils = require('./utils.js');

exports.create = function(options){
	var options = options || {},
		env = options.env || window,
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath, {
			'max reconnection attempts': Infinity
		});

	var workerProvider = new WorkerProvider(socket);

	if(options.maxTimeout) workerProvider.maxTimeout = options.maxTimeout;
	if(options.maxWorkerCount) workerProvider.maxWorkerCount = options.maxWorkerCount;

	return workerProvider.api;
};

var WorkerProvider = function(socket){
	this.socket = socket;
	this.workers = {};
	this.kill = _.once(_.bind(this.kill, this));

	socket.on("connect", _.bind(this.connectionHandler, this));
	socket.on("message", _.bind(this.messageHandler, this));
	socket.on("disconnect", _.bind(this.disconnectionHandler, this));
};

WorkerProvider.prototype.maxWorkerCount = 1000;
WorkerProvider.prototype.maxTimeout = 1000 * 60;
WorkerProvider.prototype.log = utils.noop;

WorkerProvider.prototype.kill = function(){
	this.destroyWorkers();

	this.socket.removeListener("connect", this.connectionHandler);
	this.socket.removeListener("message", this.messageHandler);
	this.socket.removeListener("disconnect", this.disconnectionHandler);
	
	this.socket = void 0;
};

WorkerProvider.prototype.sendToSocket = function(message){
	this.socket.send(JSON.stringify(message));
};

WorkerProvider.prototype.connectionHandler = function(){
	this.log('Connected');
	if(this.isReconnecting){
		window.location.reload(true); // Reload on reconnect
	} else {
		this.register();
	}
};

WorkerProvider.prototype.messageHandler = function(message){
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

WorkerProvider.prototype.workerMessageHandler = function(message){
	var workerId = message.id,
		message = message.message;

	var worker = this.workers[workerId];
	if(worker === void 0){ // No longer listening to this worker
		return;
	};

	worker.postMessage(message);
};

WorkerProvider.prototype.spawnWorkerHandler = function(message){
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

	worker = createWorker(workerId, {
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

	worker.onmessage = function(message){
		self.sendToSocket({
			type: "workerMessage",
			id: workerId,
			message: message
		});	
	};

	if(workerConfig.timeout){
		workerTimeout = setTimeout(function(){
			worker.kill();
		}, workerConfig.timeout);
	}
	
	this.workers[workerId] = worker;
	
	worker.start(workerConfig);
	
	return worker;
};

WorkerProvider.prototype.killWorkerHandler = function(message){
	var worker = this.workers[message.id];
	if(worker === void 0) return;
	worker.kill();
};

WorkerProvider.prototype.disconnectionHandler = function(){
	this.log('Disconnected');
	this.destroyWorkers();
	this.isReconnecting = true;
};

WorkerProvider.prototype.destroyWorkers = function(){
	_.each(this.workers, function(worker){
		worker.kill();
	});

	this.workers = {};	
	this.workerCount = 0;
};

WorkerProvider.prototype.register = function(){
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