var _ = require("underscore");
exports.isSimilar = isSimilar = function(subObject, superObject){
	return _.all(subObject, function(value, key){
		if(_.isObject(value) || _.isArray(value)){
			return isSimilar(value, superObject[key]);
		}

		return superObject[key] === value;
	});
};

exports.logEvents = logEvents = function(logger, obj, prefix, eventsToLog){
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

exports.stopLoggingEvents = stopLoggingEvents = function(obj, eventLoggingFunctions){
	eventLoggingFunctions.forEach(function(eventLoggingFunction){
		var event = eventLoggingFunction[0],
			func = eventLoggingFunction[1];

		obj.removeListener(event, func);
	});
};