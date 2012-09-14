define(function(require, exports, module) {
	var createLogger = require('/src/logger.js').create;
	var EventEmitter = require('/lib/nodeEvents.js').EventEmitter;

	exports.create = function(id, data){
		var emitter = new EventEmitter();
		var workerSocket = new WorkerSocket(id, emitter);
		return workerSocket;
	};

	exports.WorkerSocket = WorkerSocket = function(id, emitter){
		var self = this;

		this._id = id;
		this._isDone = false;
		this._emitter = emitter;
		this._logger = createLogger({prefix: "WorkerSocket-" + this._id});

		this.on("kill", function(){
			self.kill();
		});

		this._logger.trace("Created");
	};

	WorkerSocket.prototype.run = function(runData){
		this._iframe = iframe = document.createElement("IFRAME"); 
		document.body.appendChild(iframe);
		var iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;

		var iframeData = {
			scripts: runData.scripts
		};

		var iframeTemplate = "";
		iframeTemplate += "<html>";
		iframeTemplate += "<head>";
		iframeTemplate += "<script>window.thrillSocket = window.parent.thrillProvider.getWorkerSocket('" + this._id + "')</script>";
		iframeTemplate += "{{#scripts}}";
		iframeTemplate += '<script src="{{{.}}}"><\/script>';
		iframeTemplate += "{{/scripts}}";
		iframeTemplate += "</head>";
		iframeTemplate += "<body>";
		iframeTemplate += "</body>";
		iframeTemplate += "</html>";

		var iframeContent = Mustache.render(iframeTemplate, iframeData);
		console.log(iframeContent);

		iframeDoc.open();
		iframeDoc.write(iframeContent);
		iframeDoc.close();
	};

	WorkerSocket.prototype.getId = function(){
		return this._id;
	};

	WorkerSocket.prototype.on = function(event, callback){
		this._emitter.on(event, callback);
	};
	
	WorkerSocket.prototype.removeListener = function(event, callback){
		this._emitter.removeListener(event, callback);
	};

	WorkerSocket.prototype.echo = function(event, data){
		this._emitter.emit(event, data);
	};

	WorkerSocket.prototype.setEmitHandler = function(func){
		if(!_.isFunction(func)){
			throw "Response handler must be a function";
		}

		this._emitHandler = func;
	}

	WorkerSocket.prototype._emitHandler = function(){};

	WorkerSocket.prototype.emit = function(event, data){
		this._emitHandler(event, data)
	};
	
	WorkerSocket.prototype.isDone = function(){
		return this._isDone;
	};

	// Destroys worker socket
	WorkerSocket.prototype.kill = function(){
		if(this._isDone){
			return;
		}

		this._isDone = true;
		document.body.removeChild(this._iframe);
		this.emit('done');
		this.echo('done');
		this._logger.debug("Done");
		this.setEmitHandler(WorkerSocket.prototype._emitHandler);
		this_emitter = void 0;
		clearInterval(this._int);
	};


	// Navigates the iframe somewhere else
	WorkerSocket.prototype.navigateTo = function(url){
		var self = this,
			iframe = this._iframe;

		iframe.setAttribute("src", url + "?workerId=" + this._id); 

		var callback = function(){
			self.emit('loaded');
		};

		if (iframe.addEventListener) {
			iframe.addEventListener('load', callback);
		} else if (iframe.attachEvent) { // MICROOOSOOOOOFFTTT!!!
			iframe.attachEvent('onload', callback);
		} else {
			throw "Can't attach the onload event to the iframe.";
		}
	};

	return exports;
});
