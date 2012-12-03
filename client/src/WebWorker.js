// This works, but needs to be ironed out and properly integrated
// Need to figure out to gracefully handle same-origin policy...

var _ = require('./lib/underscore.js'),
	utils = require('./utils.js');

exports.create = function(id, options){
	var worker = new WebWorker(id);

	if(options.onDead) worker.onDead = options.onDead;
	return worker.api;
};

var WebWorker = function(id){
	this.id = id;
	this.pendingMessages = [];

	this.kill = _.once(_.bind(this.kill, this));
	this.start = _.once(_.bind(this.start, this));
	this.api = getApi.call(this);
};

var getApi = function(){
	var api = {};
	api.id = this.id;
	api.onmessage = utils.noop;
	api.postMessage = _.bind(this.onmessage, this);
	api.kill = this.kill;
	api.start = this.start;

	return api;
};

WebWorker.prototype.onDead = utils.noop;

WebWorker.prototype.onmessage = function(message){
	this.worker.postMessage(message);
};

WebWorker.prototype.postMessageFromWorker = function(message){
	this.api.onmessage(message.data);
};

WebWorker.prototype.start = function(config){
	this.worker = new Worker(config.scriptPath);
	this.worker.onmessage = _.bind(this.postMessageFromWorker, this);
};

WebWorker.prototype.kill = function(){
	this.onDead();
};
