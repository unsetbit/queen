var wd = require('wd'),
	EventEmitter = require('events').EventEmitter,
	generateId = require('node-uuid').v4,
	precondition = require('precondition');

var create = module.exports = function(options){
	options = options || {};


	var host = options.host || "",
		hostArr = host.split(":"),
		hostname = hostArr[0] || "localhost",
		port = hostArr[1] || 4444,
		populator = new SeleniumPopulator(hostname, port);

	return getApi(populator);
};

function getApi(populator){
	var api = populator.spawn.bind(populator);

	api.kill = populator.kill.bind(populator);

	return api;
}

var createSeleniumClient = function(options, callback){
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
			console.log("Selenium Populator Error: " + err);
			api.kill();
			callback();
		} else {
			callback(api);
		}
	});

	return api;
};

var SeleniumPopulator = function(host, port){
	this.host = host;
	this.port = port;
	this.clients = [];
};

SeleniumPopulator.prototype.spawn = function(options, callback){
	var self = this,
		client;

	precondition.checkDefined(options, "Options required");
	precondition.checkDefined(callback, "Callback required");
	
	options.host = this.host;
	options.port = this.port;
	
	client = createSeleniumClient(options, callback);
	this.clients.push(client);
	client.on('dead', function(){
		var index = self.clients.indexOf(client);
		if(~index) return;
		self.clients.splice(index,1);
	});
};

SeleniumPopulator.prototype.kill = function(){
	this.clients.forEach(function(client){
		client.kill();
	});
};