var IframeWorker = exports.IframeWorker = function(id){
	precondition.checkDefined(id, "IframeWorker requires a socket id");

	this._id = id;
	this._iframe = iframe = document.createElement("IFRAME"); 
	document.body.appendChild(iframe);

	_.bindAll(this, "_killCommandHandler");

	this._emitter = new EventEmitter();
	this._emitter.on("kill", this._killCommandHandler);
};

IframeWorker.create = function(id, options){
	var options = options || {},
		logger = options.logger,
		iframeWorker = new IframeWorker(id); 

	if(logger){
		iframeWorker.setLogger(logger);
	}

	return iframeWorker;
};

IframeWorker.prototype.getId = function(){
	return this._id;
};

IframeWorker.prototype.start = function(config){
	if(this._started) return false;

	this._started = true;

	if(config.scripts !== void 0){
		this._runScripts(config.scripts);
	} else if(config.url !== void 0){
		this._loadUrl(config.url);
	} else { // config.script !== void 0
		this._runScript(config.script);
	}
};

IframeWorker.prototype._runScripts = function(scriptArray){
	var iframe,
		iframeDoc,
		iframeData,
		iframeTemplate,
		iframeContent;

	iframe = this._iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent = "<html><head><title></title></head><body>";
	iframeContent += "<script>window.workerSocket = window.parent.GetWorkerSocket('" + this._id + "')</script>";
	forEach.call(scriptArray, function(script){
		iframeContent += '<script src="' + script + '"><\/script>';
		
	});
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

IframeWorker.prototype._runScript = function(script){
	var iframe,
		iframeDoc,
		iframeData,
		iframeTemplate,
		iframeContent;

	iframe = this._iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent =  "<html><head><title></title></head><body>";
	iframeContent += "<script>window.workerSocket = window.parent.GetWorkerSocket('" + this._id + "')</script>";
	iframeContent += "<script>" + script + "</script>";
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

IframeWorker.prototype._loadUrl = function(url){
	var iframe = this._iframe;
	
	iframe.setAttribute("src", url + "?iframeWorkerId=" + this._id); 
};

IframeWorker.prototype._destroy = function(){
	this._emitter.removeListener("kill", this._killCommandHandler);

	document.body.removeChild(this._iframe);	
	this._iframe = void 0;

	this.trigger('dead');
};

IframeWorker.prototype.kill = function(){
	this.emit('dead');
	this._destroy();
};

IframeWorker.prototype._killCommandHandler = function(){
	this._destroy();
};

// Events
IframeWorker.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

IframeWorker.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

IframeWorker.prototype.trigger = function(event, data){
	return this._emitter.trigger(event, [data]);
};

IframeWorker.prototype.emit = function(event, data){
	return this._emitter.trigger("emit", [event, data]);
};

// Logging
IframeWorker.prototype.eventsToLog = [];

IframeWorker.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[IframeWorker-" + this._id.substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		Utils.stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = Utils.logEvents(logger, this, prefix, this.eventsToLog);
	};
};
