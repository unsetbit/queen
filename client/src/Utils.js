var forEach = Array.prototype.forEach || function(fn, scope) {
	for(var i = 0, len = this.length; i < len; ++i) {
	  fn.call(scope, this[i], i, this);
	}
}

var Utils = {};
Utils.logEvents = function(logger, obj, prefix, eventsToLog){
	var loggingFunctions = [];
	prefix = prefix || "";

	forEach.call(eventsToLog, function(eventToLog){
		var level = eventToLog[0],
			event = eventToLog[1],
			message = prefix + eventToLog[2],
			loggingFunction = function(){
				logger[level](message);
			}

		loggingFunctions.push([event, loggingFunction]); 
		obj.on(event, loggingFunction);
	});

	return loggingFunctions;
};

Utils.stopLoggingEvents = function(obj, eventLoggingFunctions){
	forEach.call(eventsToLog, function(eventLoggingFunction){
		var event = eventLoggingFunction[0],
			func = eventLoggingFunction[1];

		obj.removeListener(event, func);
	});
};

// By Artem Barger from http://stackoverflow.com/a/901144 (TODO: resolve the questionable efficiency)
Utils.getQueryParam = function(name){
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  var results = regex.exec(window.location.search);
  if(results == null)
    return void 0;
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
};