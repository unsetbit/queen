function createAlert(){
	alert(1);
}

thrillSocket.on("eval", function(func){
	eval(func);
	thrillSocket.emit("complete");
});

thrillSocket.emit("ready");