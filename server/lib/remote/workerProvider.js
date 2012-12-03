var create = module.exports = function(emitter, attributes, workerCount, maxWorkerCount){
	var workerProvider = new WorkerProvider(emitter, attributes, workerCount, maxWorkerCount);

	return workerProvider.api;
};

var WorkerProvider = function(emitter, attributes, workerCount,  maxWorkerCount){
	this.emitter = emitter;
	this.attributes = Object.freeze(attributes);
	this.workerCount = workerCount;
	this.maxWorkerCount = maxWorkerCount;

	this.emitter.on('message', this.messageHandler.bind(this));

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

var getApi = function(){
	var self = this,
		api = {};
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.attributes = this.attributes;

	Object.defineProperty(api, "activeWorkerCount", {
		get: function(){
			return self.workerCount;
		},
		enumerable: true
	});
	
	Object.defineProperty(api, "maxWorkerCount", {
		get: function(){
			return self.maxWorkerCount;
		},
		enumerable: true
	});

	return api;
};

WorkerProvider.prototype.messageHandler = function(message){
	if(message.type === "workerCount"){
		this.workerCount = message.workerCount
	}
};