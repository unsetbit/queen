var socketio = require("socket.io"),
	http = require('http'),
	staticServer = require("node-static"),
	path = require('path'),
	_ = require('underscore');

var createBrowserHub = require('./browserHub.js').create;
var createLogger = require('./logger.js').create;

exports.create = create = function(options){
	var options = options || {},
		baseDir = options.baseDir || path.resolve(path.dirname(module.filename), '../../client'),
		httpServer = options.httpServer || http.createServer().listen(80),
		fileServer = options.fileServer || new staticServer.Server(baseDir),
		socketServer = options.socketServer || socketio.listen(httpServer, {logger: createLogger({prefix:'socket.io', threshold: 0})}),
		browserHub = options.browserHub || createBrowserHub({server: socketServer.of("/capture")}),
		minionMaster = new MinionMaster(baseDir, httpServer, fileServer, socketServer, browserHub);

	return minionMaster;
};

exports.MinionMaster = MinionMaster = function(baseDir, httpServer, fileServer, socketServer, browserHub){
	this._baseDir = baseDir;
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

	if(request.url.indexOf('/minion-master/') !== 0){
		return; // Only handle the minion master namespace
	}

	request.addListener('end', function () {
		self._fileServer.serve(request, response, function (e, res) {
            if (e && (e.status === 404)) { // If the file wasn't found
                self._fileServer.serveFile('/minion-master/404.html', 404, {}, request, response);
            }
    	});	
		
	});
};

MinionMaster.prototype.getBrowserHub = function(){
	return this._browserHub;
};