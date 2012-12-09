socket.onmessage = function(e){
	var interval = setInterval(function(){
		var guess = Math.floor(Math.random() * e.data);
		socket(guess);
		if(guess === 42){
			//console.log('I FOUND IT!');
			clearInterval(interval);
		}
	}, 100);
};