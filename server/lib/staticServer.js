var express = require('express'),
	path = require('path'),
	uuid = require('node-uuid'),
	_ = require('underscore');

exports.create = create = function(options){
	var options = options || {},
		port = options.port || 80,
		host = options.host || void 0,
		httpServer = options.httpServer || require('http').createServer().listen(port, host),
		baseWebPath = options.baseWebPath || "",
		webRoot =  options.webRoot || path.resolve(path.dirname(module.filename), '../../client/static'),
		expressInstance = express();

	httpServer.on('request', expressInstance);

	expressInstance.use(baseWebPath, express.static(webRoot));

	return httpServer;
};
