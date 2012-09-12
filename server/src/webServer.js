var http = require('http');
var staticServer = require("node-static");

exports.create = function(port, baseDir){
	var server = http.createServer(getRequestListener(baseDir)).listen(port);
	return server;
};

var getRequestListener = function(baseDir){
	var fileServer = new staticServer.Server(baseDir);

	return function(request, response){
		request.addListener('end', function () {
	        fileServer.serve(request, response, function (e, res) {
	            if (e && (e.status === 404)) { // If the file wasn't found
	                fileServer.serveFile('/test/404.html', 404, {}, request, response);
	            }
	        });
	    });
	};
};



