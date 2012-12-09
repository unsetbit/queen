var createWorker = require('./IframeWorker.js').create,
	_ = require('./lib/underscore.js'),
	io = require('./lib/socket.io.js'),
	utils = require('./utils.js');

exports.create = function(options){
	var options = options || {},
		env = options.env || window,
		socketPath = options.socketPath || "//" + window.location.host + "/capture",
		socket = options.socket || io.connect(socketPath, {
			'max reconnection attempts': Infinity,
			'reconnection limit': 60 * 1000 // At least check every minute
		});

	var workerProvider = new WorkerProvider(socket);

	if(options.maxTimeout) workerProvider.maxTimeout = options.maxTimeout;
	if(options.maxWorkerCount) workerProvider.maxWorkerCount = options.maxWorkerCount;

	return workerProvider.api;
};

var getApi = function(){
	var api = {};
	api.on = _.bind(this.emitter.on, this.emitter);
	api.removeListener = _.bind(this.emitter.removeListener, this.emitter);
	api.kill = this.kill;

	return api;
};

var WorkerProvider = function(socket){
	this.emitter = new EventEmitter();
	this.socket = socket;
	this.workers = {};
	this.kill = _.once(_.bind(this.kill, this));
	this.api = getApi.call(this);
	this.workerCount = 0;

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
	this.emitter.emit('connect');
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

	if(this.workerCount >= this.maxWorkerCount){
		this.log('Max worker count reached, can\'t spawn additional workers');
		return;
	}

	worker = this.createWorker(workerId);
	this.workers[workerId] = worker;

	if(workerConfig.timeout){
		workerTimeout = setTimeout(function(){
			worker.kill();
		}, workerConfig.timeout);
	}

	worker.onDead = function(){
		if(workerConfig.timeout){
			clearTimeout(workerTimeout);
		}

		delete self.workers[workerId];

		self.workerCount--;
		if(self.workerCount === (self.maxWorkerCount - 2)){
			self.sendToSocket({
				type: 'available'
			});
			self.emitter.emit('available');
		}

		self.emitter.emit('newWorkerCount', self.workerCount);
		self.sendToSocket({
			type: "workerDead",
			id: workerId
		})
	};

	this.workerCount++;
	if(this.workerCount === (this.maxWorkerCount - 1)){
		self.sendToSocket({
			type: 'unvailable'
		});
		this.emitter.emit('unavailable');
	}
	self.emitter.emit('newWorkerCount', self.workerCount);
	
	this.sendToSocket({
		type:"spawnedWorker",
		id: workerId
	});

	worker.start(workerConfig);
};

WorkerProvider.prototype.createWorker = function(id){
	var self = this,
		worker = createWorker(id);

	worker.onmessage = function(message){
		self.sendToSocket({
			type: "workerMessage",
			id: id,
			message: message
		});	
	};

	return worker;
};

WorkerProvider.prototype.killWorkerHandler = function(message){
	var worker = this.workers[message.id];
	if(worker === void 0) return;
	worker.kill();
};

WorkerProvider.prototype.disconnectionHandler = function(){
	this.log('Disconnected');
	this.emitter.emit('disconnect');
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