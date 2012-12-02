workerSocket.onmessage = function(){
	console.log('pong');
	setTimeout(function(){
		console.log('ping');
		workerSocket('ping');
	},1000);
};

setTimeout(function(){
	console.log('ping');
	workerSocket('ping');	
}, 1000);
