var create = module.exports = function(onSendToSocket, workerProvider){

	var self = {
		sendToSocket: onSendToSocket
	};

	workerProvider.on('workerCountUpdated', newWorkerCountHandler.bind(self));
};

var newWorkerCountHandler = function(count){
	var self = this;

	self.sendToSocket({
		type: "workerCount", 
		workerCount: count
	});
};