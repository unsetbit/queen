define(function(require, exports, module) {
	var createLogger = require('/src/logger.js').create;
	var EventEmitter = require('/lib/nodeEvents.js').EventEmitter;

	exports.create = function(id, options){
		var options = options || {},
			emitter = options.emitter || new EventEmitter(),
			logger = options.logger || createLogger({prefix: "WorkerSocket"}),
			workerSocket = new WorkerSocket(id, emitter, logger);

		workerSocket.setEmitter(emitter);

		return workerSocket;
	};

	exports.WorkerSocket = WorkerSocket = function(id, emitter, logger){
		var self = this;

		if(id === void 0){
			throw "WorkerSocket requires a socket id";
		}

		if(emitter === void 0){
			throw "WorkerSocket requires an emitter";
		}

		if(logger === void 0){
			throw "WorkerSocket requires a logger";
		}

		this._id = id;
		this._logger = logger;

		_.bindAll(this, "_killCommandHandler");
		
		this.setEmitter(emitter);
		
		this._logger.trace("Created");
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
		this._logger.debug("Done");
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
		iframeTemplate += "<script>window.thrillSocket = window.parent.thrillProvider.getSocket('" + this._id + "')</script>";
		iframeTemplate += "{{#scripts}}";
		iframeTemplate += '<script src="{{{.}}}"><\/script>';
		iframeTemplate += "{{/scripts}}";
		iframeTemplate += "</head>";
		iframeTemplate += "<body>";
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
