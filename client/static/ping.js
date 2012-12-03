onmessage = function(e){
	setTimeout(function(){
		postMessage('ping');
	}, 1000);
};

postMessage('ping');