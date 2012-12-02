workerSocket.onmessage = function(maxNumber){
	var interval = setInterval(function(){
		var guess = Math.floor(Math.random() * maxNumber);
		workerSocket(guess);
		if(guess === 42){
			//console.log('I FOUND IT!');
			clearInterval(interval);
		}
	}, 1);
};
