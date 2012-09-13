define(function(require, exports, module) {
	var createLogger = require('/src/logger.js').create;
	var EventEmitter = require('/lib/nodeEvents.js').EventEmitter;

	exports.create = function(id, url){
		var emitter = new EventEmitter();
		var workerSocket = new WorkerSocket(id, emitter);

		if(url !== void 0){
			workerSocket.navigateTo(url);
		}

		return workerSocket;
	};

	exports.WorkerSocket = WorkerSocket = function(id, emitter){
		var self = this;

		this._id = id;
		this._emitter = emitter;
		this._logger = createLogger({prefix: "WorkerSocket-" + this._id});

		this._iframe = iframe = document.createElement("IFRAME"); 
		document.body.appendChild(iframe); 

		this.on("kill", function(){
			self.kill();
		});

		this._logger.trace("Created");
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
	
	// Destroys worker socket
	WorkerSocket.prototype.kill = function(){
		document.body.removeChild(this._iframe);
		this.emit('done');
		this.echo('done');
		this._logger.debug("Done");
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
