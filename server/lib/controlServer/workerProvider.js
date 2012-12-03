var utils = require('../utils.js');

var create = module.exports = function(workerProvider, onSendToSocket, options){
	var workerProvider = new WorkerProvider(workerProvider, onSendToSocket);

	options = options || {};
	if(options.logger) workerProvider.log = options.logger;

	return workerProvider;
};

var WorkerProvider = function(workerProvider, onSendToSocket){
	this.workerProvider = workerProvider;
	this.onSendToSocket = onSendToSocket;

	workerProvider.on('workerCountUpdated', this.newWorkerCountHandler.bind(this));
};

WorkerProvider.prototype.log = utils.noop;

WorkerProvider.prototype.newWorkerCountHandler = function(count){
	this.sendToSocket({
		type: "workerCount", 
		workerCount: count
	});
};