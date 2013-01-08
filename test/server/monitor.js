var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	testedModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../../lib/server/monitor.js'));

var Monitor = testedModule.Monitor;
var create = testedModule.create;
var MESSAGE_TYPE = testedModule.MESSAGE_TYPE;
var WORKER_PROVIDER_MESSAGE_TYPE = testedModule.WORKER_PROVIDER_MESSAGE_TYPE;

var createMockSocket = function(){
	var socket = {};
	var eventEmitter = socket.emitter = new EventEmitter();
	socket.on = eventEmitter.on.bind(eventEmitter);
	socket.removeListener = eventEmitter.removeListener.bind(eventEmitter);
	socket.send = sinon.spy();

	return socket;
};

var createMockWorkerProvider = function(){
	var mock = sinon.spy();
	var eventEmitter = mock.eventEmitter = new EventEmitter();
	
	mock.on = sinon.spy(eventEmitter.on.bind(eventEmitter));
	mock.removeListener = sinon.spy(eventEmitter.removeListener.bind(eventEmitter));
	mock.kill = sinon.spy(function(){eventEmitter.emit('dead')});
	mock.toMap = sinon.spy();
	mock.id = "1";
	mock.attributes = {name: "Test"};
	return mock;
};

var createMockQueen = function(){
	var queen = {};
	queen.on = sinon.spy();
	queen.workerProviders = [createMockWorkerProvider()];
	return queen;
};

exports.browserWorkerProvider = {
	setUp: function(callback){
		this.TEST_STRING = "Hello, world!";
		this.TEST_OBJECT = {message: this.TEST_STRING};
		this.spy = sinon.spy();
		this.socket = createMockSocket();
		this.queen = createMockQueen();
		this.monitor = new Monitor(this.queen, this.socket);
		callback();
	},
	create: function(test){
		var monitor;
		
		test.throws(function(){monitor = create()}, "Able to construct with missing required params");
		
		monitor = create(this.queen, this.socket);
		test.ok(monitor !== void 0, "Unable to construct with valid params");

		test.done();
	},
	construct: function(test){
		var monitor;
		test.throws(function(){monitor = new Monitor()}, "Able to construct with missing required params");
		
		monitor = new Monitor(this.queen, this.socket);
		test.ok(monitor instanceof Monitor, "Unable to construct with valid params");

		test.done();
	},
	kill: function(test){
		this.monitor.api.on('dead', this.spy);
		this.monitor.kill();

		test.ok(this.spy.calledOnce, "Dead callback not called");
		test.done();
	},
	connectionHandler: function(test){
		var socket = createMockSocket();
		this.monitor.connectionHandler(socket);
		test.ok(socket.send.calledOnce, "New worker provider message not sent");
		test.equal(this.monitor.sockets.length, 1, "Socket count incorrect");
		test.done();
	},
	disconnectionHandler: function(test){
		var socket = createMockSocket();
		this.monitor.connectionHandler(socket);
		test.equal(this.monitor.sockets.length, 1, "Socket count incorrect");
		socket.emitter.emit('disconnect');
		test.equal(this.monitor.sockets.length, 0, "Socket count incorrect");
		test.done();
	},
	sendToSockets: function(test){
		var socket = createMockSocket();
		this.monitor.connectionHandler(socket);
		this.monitor.sendToSockets('');
		// call count is 2 because first is the new worker provider, second the message
		test.equal(socket.send.callCount, 2, "Message not sent to socket");
		test.done();
	},
	workerProviderHandler: function(test){
		var spy = sinon.spy(this.monitor, "sendToSockets");
		var wp = createMockWorkerProvider();
		this.monitor.workerProviderHandler(wp);
		test.ok(spy.calledOnce, "send to scokets not called");
		
		test.ok(wp.on.calledWith('dead'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('worker'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('workerDead'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('unresponsive'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('responsive'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('available'), "On dead event not being listened to");
		test.ok(wp.on.calledWith('unavailable'), "On dead event not being listened to");
		
		test.done();
	}
};