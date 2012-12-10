window.socket.onMessage = function(){
	setTimeout(function(){
		socket('ping');
	}, 1000);
};

socket('ping');
