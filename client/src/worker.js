define(function(require, exports, module) {
	var createLogger = require('/src/logger.js').create;
	var EventEmitter = require('/lib/nodeEvents.js').EventEmitter;

	exports.create = function(id, url){
		var commandEmitter = new EventEmitter();
		var emitter = new EventEmitter();
		var worker = new Worker(id, commandEmitter, emitter);

		if(url !== void 0){
			worker.navigateTo(url);
		}

		return worker;
	};

	exports.Worker = Worker = function(id, commandEmitter, emitter){
		var self = this;

		this._id = id;
		this._commandEmitter = commandEmitter;
		this._emitter = emitter;
		this._logger = createLogger({prefix: "Worker-" + this._id});
		this._socket = {
			emit: _.bind(this._emitWorkEvent, this),
			on: this._commandEmitter.on,
			removeListener: this._commandEmitter.removeListener
		};

		this._iframe = iframe = document.createElement("IFRAME"); 
		document.body.appendChild(iframe); 

		this._commandEmitter.on("pong", function(){
			console.log("pong");
		});

		setInterval(function(){
			console.log("ping");
			self._emitWorkEvent("ping", "ping");
		}, 3000);

		this._logger.trace("Created");
	};

	// Sends command to iframe
	Worker.prototype.command = function(command, data){
		this._commandEmitter.emit(command, data);
	};

	// Subscribes to worker events
	Worker.prototype.on = function(event, callback){
		this._emitter.on(event, callback);
	};

	// Sends work event emissions through worker emitter
	Worker.prototype._emitWorkEvent = function(event, callback){
		this._emitter.emit("workEvent", event, callback);
	};
	
	// Unsubscribes from worker events
	Worker.prototype.removeListener = function(event, callback){
		this._emitter.removeListener(event, callback);
	};

	// Gets the worker emitter object
	Worker.prototype.getSocket = function(){
		return this._socket;
	};

	// Navigates the iframe somewhere else
	Worker.prototype.navigateTo = function(url){
		var self = this,
			iframe = this._iframe;

		iframe.setAttribute("src", url + "?workerId=" + this._id); 

		var callback = function(){
			self._emitWorkEvent('loaded');
		};

		if (iframe.addEventListener) {
			iframe.addEventListener('load', callback);
		} else if (iframe.attachEvent) { // MICROOOSOOOOOFFTTT!!!
			iframe.attachEvent('onload', callback);
		} else {
			throw "Can't attach the onload event to the iframe.";
		}
	};

	// Destroys worker
	Worker.prototype.destroy = function(){
		this._commandEmitter.emit('kill');
		document.body.removeChild(this._iframe);
		this._emitter.emit('dead');
		this._logger.debug("Dead");

		// Clear fields
		this._emitter = void 0;
		this._commandEmitter = void 0;
		this._emitter = void 0;
		this._logger = void 0;
		this._socket = void 0;
		this._iframe = void 0;
	};

	return exports;
});
