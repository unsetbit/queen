var _ = require("underscore");

exports.isSimilar = isSimilar = function(subObject, superObject){
	if(superObject === void 0){
		return true;
	}

	return _.all(subObject, function(value, key){
		if(_.isObject(value) || _.isArray(value)){
			return isSimilar(value, superObject[key]);
		}
		return superObject[key] === value;
	});
};

exports.noop = function(){};