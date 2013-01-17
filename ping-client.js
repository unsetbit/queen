// queenSocket is a global variable queen injects in 
// to this context
queenSocket.onMessage = function(number){
	// Wait one second, then send the number + 1 back
	// to the server-side script
	setTimeout(function(){
		queenSocket(number + 1);
	}, 1000);
};