var wd = require('wd'),
	EventEmitter = require('events').EventEmitter,
	generateId = require('node-uuid').v4,
	precondition = require('precondition');

var create = module.exports = function(username, accessKey, options){
	options = options || {};
	var username = username,
		apikey = apikey,
		host = options.host || "ondemand.saucelabs.com",
		port = options.port || 80,
		populator = new SaucePopulator(host, port, username, accessKey);

	return getApi(populator);
};

function getApi(populator){
	var api = populator.spawn.bind(populator);
	api.kill = populator.kill.bind(populator);

	return api;
}

var createSauceClient = function(options, callback){
	var client = wd.remote(options),
		emitter = new EventEmitter(),
		api = {};

	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = function(callback){
		client.quit(callback);
		emitter.emit('dead');
	};
	api.options = options;

	client.init(options, function(err){
		client.get(options.captureUrl);
		
		if(err){
			api.kill();
			callback();
		} else {
			callback(api);
		}
	});

	return api;
};

var SaucePopulator = function(host, port, username, accessKey ){
	this.host = host;
	this.port = port;
	this.username = username;
	this.accessKey  = accessKey;

	this.clients = [];
};

SaucePopulator.prototype.spawn = function(options, callback){
	var self = this,
		client;

	precondition.checkDefined(options, "Options required");
	precondition.checkDefined(callback, "Callback required");
	
	options.host = this.host;
	options.port = this.port;
	options.username = this.username;
	options.accessKey = this.accessKey;

	client = createSauceClient(options, callback);
	this.clients.push(client);
	client.on('dead', function(){
		var index = self.clients.indexOf(client);
		if(~index) return;
		self.clients.splice(index,1);
	});
};

SaucePopulator.prototype.kill = function(){
	this.clients.forEach(function(client){
		client.kill();
	});
};