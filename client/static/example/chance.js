socket.onMessage = function(message){
	var interval = setInterval(function(){
		var guess = Math.floor(Math.random() * message);
		socket(guess);
		if(guess === 42){
			clearInterval(interval);
		}
	}, 100);
};