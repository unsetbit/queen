var EventEmitter = require('events').EventEmitter,
	_ = require('underscore'),
	useragent = require("useragent"),
	uuid = require('node-uuid'),
	precondition = require('precondition');

var create = function(socket, options){
	precondition.isDefined(socket, "BrowserWorkerProvider requires a socket.");

	options = options || {};

	var self = {},
		emitter = new EventEmitter(),
		api,
		attributes = options.attributes || {};

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

	self.attributes = Object.freeze(attributes);
	self.socket = socket;
	self.emit = emitter.emit.bind(emitter);
	self.workerEmitters = {};
	self.workerCount = 0;
	self.maxWorkers = options.maxWorkers || 100;
	self.log = options.logger || function(){};

	var api = getWorker.bind(self);
	api.kill =  _.once(kill.bind(self));
	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);

	Object.defineProperty(api, 'attributes', {
		value: self.attributes,
		enumerable: true
	});

	socket.on('disconnect', api.kill);

	return api;
};

var kill = function(){
	_.each(this.workerEmitters, function(workerEmitter, workerId){
		socket.emit('killWorker', workerId);
	});
	this.workerEmitters = {};
	this.emit('dead');
};

var workerEventHandler = function(id, event, data){
	var workerEmitter = this.workerEmitters[id];
	if(workerEmitter === void 0) return;
	workerEmitter.emit(event, data);
};

var getWorker = function(workerConfig, timeout){
	if(workerConfig === void 0) return;

	var self = this,
		socket = this.socket,
		workerEmitters = this.workerEmitters,
		workerEmitter,
		workerId;

	if(this.workerCount >= this.maxWorkers){
		this.log("Unable to spawn worker because of reached limit");
		return;
	}

	this.workerCount += 1;
	if(this.workerCount === this.maxWorkers){
		this.log("Worker capacity reached, unable to spawn additional workers");
		this.emit("unavailable");
	}

	workerEmitter = new EventEmitter();
	workerId = uuid.v4();

	workerEmitters[workerId] = workerEmitter;

	var worker = function(event, data){
		socket.emit('workerEvent', {
			id: workerId,
			event: event,
			data: data
		});
	};

	worker.on = _.bind(workerEmitter.on, workerEmitter);
	worker.removeListener = _.bind(workerEmitter.removeListener, workerEmitter);
	worker.kill = _.once(function(){
		socket.emit('killWorker', workerId);
		workerEmitter.emit('dead');
	});

	worker.on("dead", function(){
		delete workerEmitters[workerId];
		if(self.workerCount-- === self.maxWorkers){
			this.log("Able to spawn more workers");
			self.emit('available');
		}
	});

	Object.defineProperty(worker, 'attributes', {
		value: self.attributes,
		enumerable: true
	});

	this.log("New worker: " + workerId);
	socket.emit("spawnWorker", {
		id: workerId,
		workerConfig: workerConfig,
		timeout: timeout
	});

	this.emit("worker", worker);

	return worker;
};
