var socketio = require("socket.io"),
	http = require('http'),
	staticServer = require("node-static"),
	path = require('path'),
	winston = require('winston'),
	fs = require('fs'),
	EventEmitter = require('events').EventEmitter,
	_ = require('underscore');

var createBrowserHub = require('./browserHub.js').create;

exports.create = create = function(options){
	var options = options || {},
		logger = options.logger || new (winston.Logger)({transports: [new (winston.transports.Console)() ]}),
		baseDir = options.baseDir || path.resolve(path.dirname(module.filename), '../../client/static'),
		baseWebPath = options.baseWebPath || "/minion-master";
		browserCapturePath = options.browserCapturePath || "/capture";
		httpServer = options.httpServer || http.createServer().listen(80),
		fileServer = options.fileServer || new staticServer.Server(baseDir),
		socketServer = options.socketServer || socketio.listen(httpServer, {logger: logger}),
		browserHub = options.browserHub || createBrowserHub({server: socketServer.of(browserCapturePath), logger:logger}),
		minionMaster = new MinionMaster(baseDir, baseWebPath, httpServer, fileServer, socketServer, browserHub);

	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(baseDir, baseWebPath, httpServer, fileServer, socketServer, browserHub){
	this._baseDir = baseDir;
	this._baseWebPath = baseWebPath;
	this._urlPattern = new RegExp("(" + this._baseWebPath + ")/(.+)", "i");
	this._fileServer = fileServer;
	this._socketServer = socketServer;
	this._browserHub = browserHub;
	this._httpServer = void 0; // uses setter
	
	_.bindAll(this, "_httpRequestHandler");

	this.setHttpServer(httpServer);
};

MinionMaster.prototype.setHttpServer = function(httpServer){
	if(this._httpServer === httpServer){
		return;
	}

	if(this._httpServer !== void 0){
		this._httpServer.removeListener("request", this._httpRequestHandler);
	}

	this._httpServer = httpServer;

	if(this._httpServer !== void 0){
		this._httpServer.on("request", this._httpRequestHandler);
	}
};

MinionMaster.prototype.getHttpServer = function(){
	return this._httpServer;
};

MinionMaster.prototype._httpRequestHandler = function(request, response){
	var self = this;
	if(request.url.indexOf(this._baseWebPath) !== 0){
		return; // Only handle the minion master namespace
	}

	var regexValues = request.url.match(this._urlPattern);
	var filePath = this._baseDir + "/" + regexValues[2]; // file

	request.addListener('end', function () {
		var promise = new EventEmitter;
		fs.stat(filePath, function (e, stat) {
	        if (e) {
                self._fileServer.serveFile('/404.html', 404, {}, request, response);
	        	return;
	        }

	        self._fileServer.respond(null, 200, {}, [filePath], stat, request, response, function (status, headers) {
	            self._fileServer.finish(status, headers, request, response, promise);
	        });
	    });     
	});
};

MinionMaster.prototype.getBrowserHub = function(){
	return this._browserHub;
};