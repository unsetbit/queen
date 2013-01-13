var _ = require('./lib/underscore.js'),
	require('./lib/json2.js'),
	EventEmitter = require('./lib/eventEmitter.js').EventEmitter,
	createWorker = require('./IframeWorker.js').create,
	utils = require('./utils.js'),
	MESSAGE_TYPE = require('../protocol.js').WORKER_PROVIDER_MESSAGE_TYPE;

window.io = io;

module.exports = function(captureUrl, options){
	var options = options || {},
		env = options.env || window,
		socket = io.connect(captureUrl, {
			'max reconnection attempts': Infinity,
			'reconnection limit': 60 * 1000 // At least check every minute
		});

	var workerProvider = new WorkerProvider(socket);
	
	if(options.workerTimeout) workerProvider.workerTimeout = options.workerTimeout;
	if(options.maxWorkerCount) workerProvider.maxWorkerCount = options.maxWorkerCount;
	if(options.logger) workerProvider.log = options.logger;

	return workerProvider.api;
};

var getApi = function(){
	var api = {};
	api.on = _.bind(this.emitter.on, this.emitter);
	api.removeListener = _.bind(this.emitter.removeListener, this.emitter);
	api.kill = this.kill;
	api.attributes = this.attributes;
	
	return api;
};

var WorkerProvider = function(socket){
	var self = this;

	this.emitter = new EventEmitter();
	this.socket = socket;
	this.workers = {};
	this.kill = _.once(_.bind(this.kill, this));
	this.workerCount = 0;

	socket.on("connect", _.bind(this.connectionHandler, this));
	socket.on("message", _.bind(this.messageHandler, this));
	socket.on("disconnect", _.bind(this.disconnectionHandler, this));

	this.attributes = {
		populatorClientId: utils.getParameterByName('clientId'),
		userAgent: navigator.userAgent,
		capabilities: {}
	};

	// fill up capabilities
	_.each(Modernizr, function(value, key){
		if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
			self.attributes.capabilities[key] = value;
		}
	});

	this.api = getApi.call(this);
};

WorkerProvider.prototype.maxWorkerCount = 100;
WorkerProvider.prototype.workerTimeout = Infinity;
WorkerProvider.prototype.log = utils.noop;

WorkerProvider.prototype.kill = function(){
	this.destroyWorkers();

	this.emitter.emit('dead');
	this.socket = void 0;

	if(this.heartbeatTimer){
		clearInterval(this.heartbeatTimer);
		delete this.heartbeatTimer
	}
};

WorkerProvider.prototype.sendToSocket = function(message){
	this.socket.send(JSON.stringify(message));
};

WorkerProvider.prototype.connectionHandler = function(){
	if(this.isReconnecting){ // Reload on reconnect
		window.location.reload(true);
	} else {
		this.log('Connected');
		this.emitter.emit('connect');
		this.startHeartbeats();
		this.register();
	}
};

WorkerProvider.prototype.startHeartbeats = function(interval){
	var self = this;

	function heartbeat(){
		self.sendToSocket([MESSAGE_TYPE['heartbeat']]);
	}

	this.heartbeatTimer = setInterval(heartbeat, interval);
};

WorkerProvider.prototype.messageHandler = function(message){
	message = JSON.parse(message);
	switch(message[0]){
		case MESSAGE_TYPE['start heartbeats']:
			this.startHeartbeats(message[1]);
			break;
		case MESSAGE_TYPE['worker message']:
			this.workerMessageHandler(message[1], message[2]);
			break;
		case MESSAGE_TYPE['spawn worker']:
			this.spawnWorkerHandler(message[1], message[2]);
			break;
		case MESSAGE_TYPE['kill worker']:
			this.killWorkerHandler(message[1]);
			break;
	}
};

WorkerProvider.prototype.workerMessageHandler = function(workerId, workerMessage){
	var worker = this.workers[workerId];
	
	if(worker === void 0) return;

	worker.postMessage(workerMessage);
};

WorkerProvider.prototype.spawnWorkerHandler = function(workerId, workerConfig){
	this.log('Spawning Worker');

	var self = this,
		timeout = workerConfig.timeout,
		worker,
		workerTimeout;

	if(this.workerCount >= this.maxWorkerCount){
		this.log('Max worker count reached, can\'t spawn additional workers');
		return;
	}

	worker = createWorker(workerId);

	this.workers[workerId] = worker;
	if(workerConfig.timeout && workerConfig.timeout < this.workerTimeout){
		workerTimeout = setTimeout(function(){
			worker.kill("timeout");
		}, workerConfig.timeout);
	} else if(this.workerTimeout !== Infinity && this.workerTimeout !== void 0){
		workerTimeout = setTimeout(function(){
			worker.kill("timeout");
		}, this.workerTimeout);
	}

	worker.api.on('message', function(message){
		self.sendToSocket([
			MESSAGE_TYPE['worker message'],
			workerId,
			message
		]);
	});

	worker.api.on('dead', function(reason){
		if(workerTimeout !== void 0){
			clearTimeout(workerTimeout);	
		}
				
		delete self.workers[workerId];

		self.workerCount--;
		if(self.workerCount === (self.maxWorkerCount - 1)){
			self.sendToSocket([MESSAGE_TYPE['available']]);
			self.emitter.emit('available');
		}

		self.emitter.emit('workerDead', workerId);
		self.sendToSocket([
			MESSAGE_TYPE['worker dead'],
			workerId,
			reason
		]);
	});

	this.workerCount++;
	if(this.workerCount === (this.maxWorkerCount)){
		self.sendToSocket([MESSAGE_TYPE['unavailable']]);
		this.emitter.emit('unavailable');
	}
	
	this.sendToSocket([
		MESSAGE_TYPE['worker spawned'],
		workerId
	]);

	worker.start(workerConfig);

	self.emitter.emit('worker', worker.api);
};

WorkerProvider.prototype.killWorkerHandler = function(workerId){
	var worker = this.workers[workerId];
	if(worker === void 0) return;
	worker.kill();
};

WorkerProvider.prototype.disconnectionHandler = function(){
	this.log('Disconnected');
	this.emitter.emit('disconnect');
	this.destroyWorkers();
	this.isReconnecting = true;
	if(this.heartbeatTimer){
		clearInterval(this.heartbeatTimer);
		delete this.heartbeatTimer
	}
};

WorkerProvider.prototype.destroyWorkers = function(){
	_.each(this.workers, function(worker){
		worker.kill();
	});

	this.workers = {};	
	this.workerCount = 0;
};

WorkerProvider.prototype.register = function(){
	this.sendToSocket([
		MESSAGE_TYPE['register'],
		this.attributes
	]);
};