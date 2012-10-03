Utils = {};
Utils.logEvents = function(logger, obj, prefix, eventsToLog){
	var loggingFunctions = [];
	prefix = prefix || "";

	eventsToLog.forEach(function(eventToLog){
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
	eventLoggingFunctions.forEach(function(eventLoggingFunction){
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