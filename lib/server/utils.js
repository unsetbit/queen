var noop = exports.noop = function(){};

var each = exports.each = function(obj, func, context){
	for(var key in obj){
		if(obj.hasOwnProperty(key)){
			func.call(context, obj[key], key, obj);
		}
	}
};

var filter = exports.filter = function(obj, func, context){
	var results = [];

	each(obj, function(value, key){
		if(func.call(context, value, key, obj)) results.push(value);
	});

	return results;
};

var values = exports.values = function(obj){
	var results = [];
	each(obj, function(value){ results.push(value); });
	return results;
};

var isArray = exports.isArray = function(obj){
	return toString.call(obj) === '[object Array]';
};

var toString = Object.prototype.toString;

// From underscore: https://github.com/documentcloud/underscore
var once = exports.once = function(func){
	var ran = false, result;
	return function(){
		if(ran) return result;
		ran = true;
		result = func.apply(this, arguments);
		func = null;
		return result;
	};
};

var getExternalIpAddress = exports.getExternalIpAddress = function(){
	var interfaces = require('os').networkInterfaces();
	var addresses = [];
	each(interfaces, function(iface, name){
		addresses = addresses.concat(
			filter(iface, function(node){ 
				return node.family === 'IPv4' && node.internal === false;
			})
		);
	});

	if(addresses.length > 0){
		return addresses[0].address;
	}
};