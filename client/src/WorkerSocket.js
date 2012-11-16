var WorkerSocket = exports.WorkerSocket = function(id){
	precondition.checkDefined(id, "WorkerSocket requires a socket id");

	this._id = id;

	_.bindAll(this, "_doneHandler", "_killCommandHandler");

	this._emitter = new EventEmitter();
	this._emitter.on("kill", this._killCommandHandler);
	this._emitter.on("done", this._doneHandler);
};

WorkerSocket.create = function(id, options){
	var options = options || {},
		workerSocket = new WorkerSocket(id); 

	if(options.logger){
		workerSocket.setLogger(options.logger);
	}

	if(options.timeout){
		var timer = setTimeout(function(){
			workerSocket.emit('timeout');
			workerSocket.kill();
		}, options.timeout);

		workerSocket.on("done", function(){
			clearTimeout(timer);
		});
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
	
	if(_.isArray(context)){
		this._constructEmptyContext(context);
	} else {
		this._loadExistingContext(context);
	}

	this.trigger("contextSet");
};

WorkerSocket.prototype.kill = function(){
	this._emitter.removeListener("kill", this._killCommandHandler);
	this._unload();
	this.trigger('dead');
};

WorkerSocket.prototype._doneHandler = function(){
	this.kill();
	this.emit('dead');
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

WorkerSocket.prototype._loadExistingContext = function(contextUrl){
	var self = this,
		iframe = this._iframe,
		loadingTimeout;

	iframe.setAttribute("src", contextUrl + "?workerSocketId=" + this._id); 
	
	loadingTimeout = setTimeout(function(){
		self.kill();
	}, this.loadingTimeout);

	iframe.onload =function(){
		clearTimeout(loadingTimeout);
	};
};

WorkerSocket.prototype._constructEmptyContext = function(contextScripts){
	var iframe,
		iframeDoc,
		iframeData,
		iframeTemplate,
		iframeContent;

	iframe = this._iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	iframeData = {scripts: contextScripts};
	iframeContent = "";
	
	iframeContent += "<html>";
	iframeContent += "<head>";
	iframeContent += "</head>";
	iframeContent += "<body>";
	iframeContent += "<script>window.workerSocket = window.parent.GetWorkerSocket('" + this._id + "')</script>";
	forEach.call(contextScripts, function(contextScript){
		iframeContent += '<script src="' + contextScript + '"><\/script>';
		
	});
	iframeContent += "</body>";
	iframeContent += "</html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

// Events
WorkerSocket.prototype.on = function(event, callback){
	return this._emitter.on(event, callback);
};

WorkerSocket.prototype.removeListener = function(event, callback){
	return this._emitter.removeListener(event, callback);
};

WorkerSocket.prototype.trigger = function(event, data){
	return this._emitter.trigger(event, [data]);
};

WorkerSocket.prototype.emit = function(event, data){
	return this._emitter.trigger("emit", [event, data]);
};

// Logging
WorkerSocket.prototype.eventsToLog = [
	["info", "done", "Done"],
	["info", "contextSet", "Context set"],
	["warn", "timeout", "Timed out"]
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
