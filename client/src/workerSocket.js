define(function(require, exports, module) {
	var createLogger = require('./logger.js').create;
	var EventEmitter = require('../lib/nodeEvents.js').EventEmitter,
	   	logEvents = require("./utils.js").logEvents,
		stopLoggingEvents = require("./utils.js").stopLoggingEvents;
	

	exports.create = function(id, options){
		var options = options || {},
			emitter = options.emitter || new EventEmitter(),
			workerSocket = new WorkerSocket(id, emitter);

		if(options.logger){
			workerSocket.setLogger(options.logger);
		}

		workerSocket.setEmitter(emitter);

		return workerSocket;
	};

	exports.WorkerSocket = WorkerSocket = function(id, emitter){
		var self = this;

		if(id === void 0){
			throw "WorkerSocket requires a socket id";
		}

		if(emitter === void 0){
			throw "WorkerSocket requires an emitter";
		}

		this._id = id;
		this._logger = void 0;
		this._loggingFunctions = void 0;

		_.bindAll(this, "_killCommandHandler");
		
		this.setEmitter(emitter);
	};

	WorkerSocket.prototype.eventsToLog = [
		["info", "done", "Done"],
		["info", "contextSet", "Context set"]
	];

	WorkerSocket.prototype.setLogger = function(logger){
		if(this._logger === logger){
			return; // same as existing one
		}
		
		var prefix = "[WorkerSocket-" + this.getId().substr(0,4) + "] ";
		
		if(this._logger !== void 0){
			stopLoggingEvents(this, this._loggingFunctions);
		};

		this._logger = logger;

		if(this._logger !== void 0){
			this._loggingFunctions = logEvents(logger, this, prefix, this.eventsToLog);
		};
	};

	WorkerSocket.prototype.setEmitter = function(emitter){
		if(this._emitter !== void 0){
			// Detach from old emitter
			this._emitter.removeListener("kill", this._killCommandHandler);
		}

		this._emitter = emitter;

		if(this._emitter !== void 0){
			// Attach to new emitter
			this._emitter.on("kill", this._killCommandHandler);
		}
	};

	WorkerSocket.prototype._killCommandHandler = function(){
		this._unload();
		this.emit('done');
		this.echo('done');
		this.setEmitter(void 0);
	};

	WorkerSocket.prototype._unload = function(){
		if(this._iframe !== void 0){
			document.body.removeChild(this._iframe);	
			this._iframe = void 0;
		}
	};

	WorkerSocket.prototype.setContext = function(context){
		this._unload();
		
		this._iframe = iframe = document.createElement("IFRAME"); 
		document.body.appendChild(iframe);
		
		// If a context url is provided, navigate to it
		if(context.url !== void 0){
			iframe.setAttribute("src", context.url + "?thrillSocketId=" + this._id); 
		} else { // Otherwise build an empty context
			this._constructEmptyContext(context);
		}
		this.echo("contextSet");
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
		iframeTemplate += "<script>window.thrillSocket = window.parent.GetThrillSocket('" + this._id + "')</script>";
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

	WorkerSocket.prototype.getId = function(){
		return this._id;
	};

	// EVENT METHODS
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
	
	return exports;
});
