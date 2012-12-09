window.socket.onmessage = function(e){
	setTimeout(function(){
		socket('ping');
	}, 1000);
};

socket('ping');
