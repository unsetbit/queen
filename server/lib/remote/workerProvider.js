var create = module.exports = function(emitter, attributes, name, workerCount, maxWorkerCount){
	var self = {
		emitter: emitter,
		attributes: Object.freeze(attributes),
		maxWorkerCount: maxWorkerCount,
		workerCount: workerCount,
		name: name
	}

	emitter.on('message', messageHandler.bind(self));

	return getApi.call(self);
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

var messageHandler = function(message){
	if(message.type === "workerCount"){
		this.workerCount = message.workerCount
	}
};