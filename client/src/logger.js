define(function(require, exports, module) {
	exports.create = function(options){
		var logger = new Logger(options);
		return logger;
	};

	exports.Logger = Logger = function(options){
		options = options || {};
		this._threshold = options.threshold || this.threshold;
	};
	
	Logger.prototype.threshold = 4;

	Logger.prototype.setThreshold = function(threshold){
		this._threshold = threshold;
	};

	Logger.prototype.levels = ['error', 'warn', 'info', 'debug', 'trace'];

	Logger.prototype.log = function(message, level){
		if(!(console && console.log)){
			return;
		}

		level = level || 'info';
		var typeOfMessage = typeof message;
		if(typeOfMessage === "string" || typeOfMessage === "number" || typeOfMessage === "boolean"){
			console.log(level + ': ' + message);
		} else {
			console.log(level + ': ');
			console.log(message);
		}
	};

	(function(){
		for(var i = 0, len = Logger.prototype.levels.length; i<len; i++){
			var t = Logger.prototype.levels[i];
			Logger.prototype[t] = function(t){
				return function(message){
					Logger.prototype.log.call(this, message, t);
				};
			}(t)
		}
	}());
	
	return exports;
});
