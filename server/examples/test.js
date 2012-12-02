var EventEmitter = require('events').EventEmitter,
	_ = require('underscore');

var get = function(){
	var counter = 0;
	var emitter = new EventEmitter();
	
	var commandFunction = function(options){
		counter++;
		emitter.emit("count", counter);
	};

	commandFunction.on = _.bind(emitter.on, emitter);
	commandFunction.removeListener = _.bind(emitter.removeListener, emitter);

	return commandFunction;
};

var a = get();
var b = get();

a.on('count', function(num){
	console.log('a: ' + num);
});

b.on('count', function(num){
	console.log('b: ' + num);
});


a();
a();
a();
b();
a();
b();
a();