var express = require('express'),
	path = require('path'),
	uuid = require('node-uuid'),
	_ = require('underscore');

exports.create = create = function(options){
	var options = options || {},
		port = options.port || 80,
		hostname = options.hostname || 'localhost',
		httpServer = options.httpServer || require('http').createServer().listen(port, hostname),
		baseWebPath = options.baseWebPath || "",
		webRoot =  options.webRoot || path.resolve(path.dirname(module.filename), '../../client/static'),
		expressInstance = express();

	httpServer.on('request', expressInstance);

	expressInstance.use(baseWebPath, express.static(webRoot));

	return httpServer;
};
