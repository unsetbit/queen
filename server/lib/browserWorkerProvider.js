var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	useragent = require("useragent"),
	generateId = require('node-uuid').v4,
	precondition = require('precondition');

var createWorker = require('./worker.js');

var create = module.exports = function(socket, options){
	precondition.checkDefined(socket, "BrowserWorkerProvider requires a socket.");

	options = options || {};

	var attributes = options.attributes || {},
		ua,
		self;

	if(attributes.userAgent){
		ua = useragent.parse(attributes.userAgent);
		attributes.name = ua.toAgent();
		attributes.family = ua.family;
		attributes.os = ua.os;
		attributes.version = {
			major: ua.major,
			minor: ua.minor,
			path: ua.patch
		};
	}

	self = {
		socket: socket,
		emitter: new EventEmitter(),
		workerEmitters: {},
		workerCount: 0,
		maxWorkers: options.maxWorkers || 1000,
		log: options.logger || utils.noop,
		attributes: Object.freeze(attributes),
	};

	self.kill = kill.bind(self);
	self.removeWorker = removeWorker.bind(this);
	
	socket.on('disconnect', self.kill);
	socket.on('killWorker', self.removeWorker);
	socket.on('workerEvent', workerEventHandler.bind(self));

	return  getApi.call(self);
};

var killWorkerHandler = function(workerId){
	self.removeWorker(workerId);
	delete this.workerEmitters[workerId];
	if(this.workerCount-- === this.maxWorkers){
		this.log("Able to spawn more workers");
		this.emitter.emit('available');
	}
};

var getApi = function(){
	var api = getWorker.bind(this);
	api.kill =  _.once(kill.bind(this));
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.attributes = this.attributes;

	return api;
};

var kill = function(){
	var self = this;
	_.each(this.workerEmitters, function(workerEmitter, workerId){
		self.socket.emit('killWorker', workerId);
		workerEmitter.emit('dead'); // Emulate the immediate death of the socket
	});
	this.workerEmitters = {};
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

var workerEventHandler = function(data){
	var worker = this.workerEmitters[data.id];
	if(worker === void 0) return;
	worker.emit(data.event, data.data);
};

var getWorker = function(workerConfig){
	var self = this;
	if(workerConfig === void 0) return;

	if(this.workerCount >= this.maxWorkers){
		this.log("Unable to spawn worker because of reached limit");
		return;
	}

	var workerId = generateId(),
		workerEmitter = new EventEmitter(),
		onEmitToSocket = function(event, data){
			self.socket.emit('workerEvent', {
				id: workerId,
				event: event,
				data: data
			});
		},
		worker = createWorker(workerId, this.attributes, workerEmitter, onEmitToSocket);
	
	this.workerEmitters[workerId] = workerEmitter;

	// Handle the case when a kill signal is sent from the server side
	worker.on("dead", function(){
		var workerEmitter = self.workerEmitters[workerId];
		if(workerEmitter === void 0){
			self.socket.emit('killWorker', workerId);
			self.removeWorker(workerId);
		}
	});

	this.log("Spawning new worker");
	this.socket.emit("spawnWorker", {
		id: workerId,
		config: workerConfig
	});

	this.emitter.emit("worker", worker);

	this.workerCount++;
	if(this.workerCount === this.maxWorkers){
		this.log("Worker capacity reached, unable to spawn additional workers");
		this.emitter.emit("unavailable");
	}

	return worker;
};

var removeWorker = function(workerId){
	delete this.workerEmitters[workerId];
	if(this.workerCount-- === this.maxWorkers){
		this.log("Able to spawn more workers");
		this.emitter.emit('available');
	}
};