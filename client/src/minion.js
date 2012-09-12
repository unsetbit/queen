define(function(require, exports, module) {
	var mockLog = function(arg){
		console.log(arg);
	}
	var mockLogger = {
		info: mockLog,
		trace: mockLog,
		log: mockLog,
		debug: mockLog,
		error: mockLog,
		warn: mockLog
	};

	exports.create = function(emitter, url){
		var minion = new Minion(emitter);

		if(url !== void 0){
			minion.navigateTo(url);
		}

		return minion;
	};

	var idCounter = 0;
	exports.Minion = Minion = function(emitter){
		var self = this;

		if(emitter === void 0){
			throw "A minion requires an emitter";
		}

		this._id = idCounter++;
		this._emitter = emitter;
		this._logger = mockLogger;
		emitter.on('message', function(message){
			self.handle(message);
		});
		
		this._iframe = iframe = document.createElement("IFRAME"); 
		document.body.appendChild(iframe); 

		this._logger.trace("Created");
	};

	Minion.prototype.emit = function(event, data){
		this._emitter.emit(event, data);
	};

	Minion.prototype.handle = function(message){
		console.log("TTAAAKING CARE OF BUSINESS");
	};

	Minion.prototype.navigateTo = function(url){
		var self = this,
			iframe = this._iframe;

		iframe.setAttribute("src", url + "?minionId=" + this._id); 

		var callback = function(){
			self.emit('ready');
		};

		if (iframe.addEventListener) {
			iframe.addEventListener('load', callback);
		} else if (iframe.attachEvent) { // MICROOOSOOOOOFFTTT!!!
			iframe.attachEvent('onload', callback);
		} else {
			throw "Can't attach the onload event to the iframe.";
		}
	};

	Minion.prototype.kill = function(){
		document.body.removeChild(this._iframe);
		this.emit('dead');
		this.setEmitter(void 0); // Disconnect attached emitter;
		this._logger.debug("Dead");
	};

	return exports;
});
