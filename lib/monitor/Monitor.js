var _ = require('../client/lib/underscore.js'),
	$ = require('./lib/jqueryModule.js'),
	io = require('../client/lib/socket.io.js'),
	require('../client/lib/json2.js'),
	EventEmitter = require('../client/lib/eventEmitter.js').EventEmitter,
	utils = require('../client/utils.js'),
	MESSAGE_TYPE = require('../protocol.js').MONITOR_MESSAGE_TYPE;

var createWorkerProvider = require('./WorkerProvider.js');

module.exports = function(captureUrl, options){
	var options = options || {},
		env = options.env || window,
		socket = io.connect(captureUrl, {
			'max reconnection attempts': Infinity,
			'reconnection limit': 60 * 1000 // At least check every minute
		});

	var monitor = new Monitor(socket);

	if(options.logger) monitor.log = options.logger;

	return monitor.api;
};
 
var getApi = function(){
	var api = {};
	api.on = _.bind(this.emitter.on, this.emitter);
	api.removeListener = _.bind(this.emitter.removeListener, this.emitter);
	api.kill = this.kill;
	api.attributes = this.attributes;
	
	return api;
};

var Monitor = function(socket){
	var self = this;

	this.emitter = new EventEmitter();
	this.socket = socket;
	this.workerProviders = {};
	this.kill = _.once(_.bind(this.kill, this));
	
	socket.on("connect", _.bind(this.connectionHandler, this));
	socket.on("disconnect", _.bind(this.disconnectionHandler, this));
	socket.on('message', _.bind(this.messageHandler, this));
	this.api = getApi.call(this);
};

Monitor.prototype.log = utils.noop;

Monitor.prototype.kill = function(){
	this.emitter.emit('dead');
	this.socket = void 0;
};

Monitor.prototype.sendToSocket = function(message){
	this.socket.send(JSON.stringify(message));
};

Monitor.prototype.connectionHandler = function(){
	if(this.isReconnecting){ // Reload on reconnect
		window.location.reload(true);
	} else {
		this.log('Connected');
		this.emitter.emit('connect');
	}
};

Monitor.prototype.disconnectionHandler = function(){
	this.log('Disconnected');
	this.emitter.emit('disconnect');
	this.isReconnecting = true;
};

Monitor.prototype.messageHandler = function(message){
	message = JSON.parse(message);
	switch(message[0]){
		case MESSAGE_TYPE['new worker provider']:
			this.newWorkerProvider(message[1]);
			break;
		case MESSAGE_TYPE['worker provider message']:
			this.workerProviderMessage(message[1], message[2]);
			break;
	}
};

Monitor.prototype.newWorkerProvider = function(workerProviderConfig){
	var self = this,

	workerProvider = createWorkerProvider(workerProviderConfig);
	this.workerProviders[workerProvider.id] = workerProvider;
	var element = workerProvider.getElement();
	
	$('#WorkerProviders').append(element);

	element.hide().animate({
		width: "toggle"
	});
	
	workerProvider.on('dead', function(){
		delete self.workerProviders[workerProvider.id];
	});
};

Monitor.prototype.workerProviderMessage = function(workerProviderId, message){
	var workerProvider = this.workerProviders[workerProviderId];
	if(!workerProvider) return;

	workerProvider(message);
};
