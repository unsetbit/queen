var browserstack = require('browserstack'),
	EventEmitter = require('events').EventEmitter,
	generateId = require('node-uuid').v4,
	precondition = require('precondition');

var create = module.exports = function(settings){
	var populator = new BrowserStackPopulator(settings);

	return getApi(populator);
};

function getApi(populator){
	var api = populator.spawn.bind(populator);
	api.kill = populator.kill.bind(populator);

	return api;
}

var createBrowserStackClient = function(client, options, callback){
	var worker,
		emitter = new EventEmitter(),
		api = {};

	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = function(callback){
		emitter.emit('dead');
		if(callback) callback();
	};

	api.options = options;

	var workerSettings = {};
	if(options.os) workerSettings.os = options.os;
	if(options.browser) workerSettings.browser = options.browser;
	if(options.url) workerSettings.url = options.url;
	if(options.device) workerSettings.device = options.device;
	if(options.version) workerSettings.version = options.version;
	workerSettings.url = options.captureUrl;

	client.createWorker(workerSettings, function(err, worker){
		if(err){
			console.log("BrowserStack Populator Error: " + err.message);
			api.kill();
			callback();
		} else {
			api.kill = function(killCallback){
				client.terminateWorker(worker.id, killCallback);
				emitter.emit('dead');
			};
			callback(api);
		}
	});

	return api;
};

var BrowserStackPopulator = function(settings){
	this.client = browserstack.createClient(settings);
	this.clients = [];
};

BrowserStackPopulator.prototype.spawn = function(options, callback){
	var self = this,
		client;

	precondition.checkDefined(options, "Options required");
	precondition.checkDefined(callback, "Callback required");
	
	worker = createBrowserStackClient(this.client, options, callback);
	this.clients.push(worker);
	worker.on('dead', function(){
		var index = self.clients.indexOf(worker);
		if(~index) return;
		self.clients.splice(index,1);
	});
};

BrowserStackPopulator.prototype.kill = function(){
	this.clients.forEach(function(worker){
		worker.kill();
	});
};