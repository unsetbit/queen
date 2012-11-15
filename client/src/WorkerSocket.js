var WorkerSocket = exports.WorkerSocket = function(id){
	precondition.checkDefined(id, "WorkerSocket requires a socket id");

	this._id = id;

	_.bindAll(this, "_killCommandHandler");

	this._emitter = new EventEmitter();
	this._emitter.on("kill", this._killCommandHandler);
};

WorkerSocket.create = function(id, options){
	var options = options || {},
		workerSocket = new WorkerSocket(id); 

	if(options.logger){
		workerSocket.setLogger(options.logger);
	}

	return workerSocket;
};

WorkerSocket.prototype.loadingTimeout = 1000;

WorkerSocket.prototype.getId = function(){
	return this._id;
};

WorkerSocket.prototype.setContext = function(context){
	this._unload();
	
	this._iframe = iframe = document.createElement("IFRAME"); 
	document.body.appendChild(iframe);
	
	// If a context url is provided, navigate to it
	if(context.url !== void 0){
		this._loadExistingContext(context);
	} else { // Otherwise build an empty context
		this._constructEmptyContext(context);
	}
	this.echo("contextSet");
};

WorkerSocket.prototype.kill = function(){
	this._emitter.removeListener("kill", this._killCommandHandler);
	this._unload();
	this.emit('done');
	this.echo('done');
	this.echo('dead');
};

WorkerSocket.prototype._killCommandHandler = function(){
	this.kill();
};

WorkerSocket.prototype._unload = function(){
	if(this._iframe !== void 0){
		document.body.removeChild(this._iframe);	
		this._iframe = void 0;
	}
};

WorkerSocket.prototype._loadExistingContext = function(context){
	var self = this,
		iframe = this._iframe,
		loadingTimeout;

	iframe.setAttribute("src", context.url + "?workerSocketId=" + this._id); 
	
	loadingTimeout = setTimeout(function(){
		self.kill();
	}, this.loadingTimeout);

	iframe.onload =function(){
		clearTimeout(loadingTimeout);
	};
};

WorkerSocket.prototype._constructEmptyContext = function(context){
	var iframe,
		iframeDoc,
		iframeData,
		iframeTemplate,
		iframeContent;

	iframe = this._iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	iframeData = {scripts: context.scripts};
	iframeTemplate = "";
	
	iframeTemplate += "<html>";
	iframeTemplate += "<head>";
	iframeTemplate += "</head>";
	iframeTemplate += "<body>";
	iframeTemplate += "<script>window.bullhorn = window.parent.GetWorkerSocket('" + this._id + "')</script>";
	iframeTemplate += "{{#scripts}}";
	iframeTemplate += '<script src="{{{.}}}"><\/script>';
	iframeTemplate += "{{/scripts}}";
	iframeTemplate += "</body>";
	iframeTemplate += "</html>";

	iframeContent = Mustache.render(iframeTemplate, iframeData);
	
	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

// Events
WorkerSocket.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

WorkerSocket.prototype.once = function(event, callback){
	return this._emitter.once(event, callback);
};

WorkerSocket.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

WorkerSocket.prototype.echo = function(event, data){
	return this._emitter.emit(event, data);
};

WorkerSocket.prototype.emit = function(event, data){
	return this._emitter.emit("emit", event, data);
};

// Logging
WorkerSocket.prototype.eventsToLog = [
	["info", "done", "Done"],
	["info", "contextSet", "Context set"]
];

WorkerSocket.prototype.setLogger = function(logger){
	if(this._logger === logger){
		return; // same as existing one
	}
	
	var prefix = "[WorkerSocket-" + this._id.substr(0,4) + "] ";
	
	if(this._logger !== void 0){
		Utils.stopLoggingEvents(this, this._loggingFunctions);
	};

	this._logger = logger;

	if(this._logger !== void 0){
		this._loggingFunctions = Utils.logEvents(logger, this, prefix, this.eventsToLog);
	};
};
