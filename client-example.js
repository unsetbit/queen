// "queenSocket" is a global variable that scripts running on queen have
// access to. It's the only variable introduced to this scope. This script 
// will execute in it's own iframe so the global context is clean otherwise.

// The "onMessage" property allows the client-side script to listen
// to messages from the server-side script. In this case we're assuming
// the server script will only send us one message, and it'll be an integer
// for the maximum number we're should guess.
queenSocket.onMessage = function(maxNumber){
	function guess(){
		var number = Math.floor(Math.random() * maxNumber);

		// This function sends a message back to the server-side script
		queenSocket(number);	
	}

	// Every second, make a guess
	setInterval(guess, 1000);
};