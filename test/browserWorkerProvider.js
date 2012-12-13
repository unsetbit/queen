var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	workerProviderModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../lib/browserWorkerProvider.js'));

var WorkerProvider = workerProviderModule.BrowserWorkerProvider;
var create = workerProviderModule.create;

var createMockWorker = function(){
	var worker = sinon.spy();
	
	worker.eventEmitter = new EventEmitter();
	worker.on = sinon.spy(worker.eventEmitter.on.bind(worker.eventEmitter));
	worker.removeListener = sinon.spy(worker.eventEmitter.removeListener.bind(worker.eventEmitter));
	worker.kill = sinon.spy(function(){worker.eventEmitter.emit('dead')});

	return worker;
};

var createMockSocket = function(){
	var socket = {};
	var eventEmitter = socket.eventEmitter = new EventEmitter();
	socket.on = eventEmitter.on.bind(eventEmitter);
	socket.removeListener = eventEmitter.removeListener.bind(eventEmitter);
	socket.send = sinon.spy();

	return socket;
};

exports.browserWorkerProvider = {
	setUp: function(callback){
		this.TEST_STRING = "Hello, world!";
		this.TEST_OBJECT = {message: this.TEST_STRING};
		this.WORKER_ID = "1";
		this.socket = createMockSocket();
		this.workerProvider = new WorkerProvider(this.socket);
		callback();
	},
	create: function(test){
		var workerProvider;
		
		test.throws(function(){workerProvider = create()}, "Able to construct with missing required params");
		
		workerProvider = create(this.socket);
		test.ok(workerProvider !== void 0, "Unable to construct with valid params");

		workerProvider = create(this.socket, {logger: function(){}});
		test.ok(workerProvider !== void 0, "Unable to construct with valid params");

		test.done();
	},
	construct: function(test){
		var workerProvider;
		test.throws(function(){workerProvider = new WorkerProvider()}, "Able to construct with missing required params");
		
		workerProvider = new WorkerProvider(this.socket);
		test.ok(workerProvider instanceof workerProviderModule.BrowserWorkerProvider, "Unable to construct with valid params");

		test.done();
	},
	sendToSocket: function(test){
		this.workerProvider.sendToSocket({ message: this.TEST_STRING });
		test.ok(this.socket.send.calledWithMatch(JSON.stringify(this.TEST_STRING)), "Message not sent to socket");

		test.done();
	},
	messageHandler: function(test){
		var stub = sinon.stub(this.workerProvider, "workerMessageHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "workerMessage"}));
		test.equal(stub.callCount, 1, "Worker message handler not called");

		stub = sinon.stub(this.workerProvider, "spawnedWorkerHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "spawnedWorker"}));
		test.equal(stub.callCount, 1, "Worker spawned handler not called");

		stub = sinon.stub(this.workerProvider, "workerDeadHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "workerDead"}));
		test.equal(stub.callCount, 1, "Worker dead handler not called");

		stub = sinon.stub(this.workerProvider, "registerHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "register"}));
		test.equal(stub.callCount, 1, "Register handler not called");

		stub = sinon.stub(this.workerProvider, "availableHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "available"}));
		test.equal(stub.callCount, 1, "Available handler not called");

		stub = sinon.stub(this.workerProvider, "unavailableHandler");
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "unavailable"}));
		test.equal(stub.callCount, 1, "Unavailable handler not called");

		test.done();
	},
	availableHandler: function(test){
		var availableSpy = sinon.spy();
		this.workerProvider.api.on('available', availableSpy);
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "available"}));

		test.equal(this.workerProvider.available, true, 'Unavailable');
		test.equal(availableSpy.callCount, 1, 'Available event not fired once');
		test.done();
	},
	unavailableHandler: function(test){
		var unavailableSpy = sinon.spy();
		this.workerProvider.api.on('unavailable', unavailableSpy);
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "unavailable"}));

		test.equal(this.workerProvider.available, false, 'Available');
		test.equal(unavailableSpy.callCount, 1, 'Available event not fired once');
		test.done();
	},
	createWorker: function(test){
		var workerListener = sinon.spy();
		this.workerProvider.api.on('worker', workerListener);

		var worker = this.workerProvider.createWorker(this.WORKER_ID);
		
		test.notStrictEqual(worker, void 0, 'Worker not created');
		test.strictEqual(worker.id, this.WORKER_ID, 'Worker id does not match given id');
		test.strictEqual(worker.provider, this.workerProvider.api, 'Worker provider does not equal worker provider');
		test.ok(workerListener.calledWith(worker), 'Worker not emitted');
		test.done();
	},
	removeDeadWorker: function(test){
		var workerDeadListener = sinon.spy();
		this.workerProvider.api.on('workerDead', workerDeadListener);

		var worker = this.workerProvider.createWorker(this.WORKER_ID);
		worker.kill();

		var expected = JSON.stringify({
			type: "killWorker",
			id: this.WORKER_ID,
		});

		test.ok(this.socket.send.calledWithMatch(expected), "Worker kill signal sent to socket");

		test.ok(workerDeadListener.calledWith(this.WORKER_ID), 'Worker death not emitted');
		test.done();
	},
	relayWorkerMessage: function(test){
		var worker = this.workerProvider.createWorker(this.WORKER_ID);
		worker(this.TEST_OBJECT);
		
		var expected = JSON.stringify({
			type: "workerMessage",
			id: this.WORKER_ID,
			message: this.TEST_OBJECT
		});

		test.ok(this.socket.send.calledWithMatch(expected), "Message sent to socket");
		test.done();
	},
	spawnedWorkerHandler: function(test){
		// Unxpected worker
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "spawnedWorker", id: this.WORKER_ID}));

		var expected = JSON.stringify({
			type: "killWorker",
			id: this.WORKER_ID
		});

		test.ok(this.socket.send.calledWithMatch(expected), "Worker kill signal not sent to socket");

		// Expected worker
		var callback = sinon.spy();
		this.workerProvider.pendingWorkers[this.WORKER_ID] = callback;
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "spawnedWorker", id: this.WORKER_ID}));

		test.ok(callback.calledOnce, "Callback not called");

		test.done();
	},
	workerDeadHandler: function(test){
		var worker = this.workerProvider.createWorker(this.WORKER_ID);

		var workerDeadListener = sinon.spy();
		this.workerProvider.api.on('workerDead', workerDeadListener);

		this.socket.eventEmitter.emit("message", JSON.stringify({type: "workerDead", id: this.WORKER_ID}));
		
		test.ok(workerDeadListener.calledOnce, "Worker death not emitted");

		test.done();
	},
	registerHandler: function(test){
		var spy = sinon.spy();
		this.workerProvider.api.on('register', spy);
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "register", attributes: this.TEST_OBJECT}));

		test.deepEqual(this.workerProvider.attributes, this.TEST_OBJECT, "Attributes not set");
		test.ok(spy.calledWithMatch(this.TEST_OBJECT), "Attributes not emitted");
		test.done();	
	},
	kill: function(test){
		var worker = this.workerProvider.createWorker(this.WORKER_ID);
		var workerDeadSpy = sinon.spy();
		var providerDeadSpy = sinon.spy();
		this.workerProvider.api.on('dead', providerDeadSpy);		
		worker.on('dead', workerDeadSpy);
		
		this.workerProvider.kill();

		var expected = JSON.stringify({type: "killWorker",id: this.WORKER_ID});
		test.ok(this.socket.send.calledWithMatch(expected), "Worker kill signal not sent to socket");
		test.equal(workerDeadSpy.callCount, 1, "Worker not killed");
		test.equal(providerDeadSpy.callCount, 1, "Worker provider not killed");
		test.done();
	},
	workerMessageHandler: function(test){
		var worker = this.workerProvider.createWorker(this.WORKER_ID);

		var spy = sinon.spy();
		worker.on('message', spy);

		this.socket.eventEmitter.emit("message", JSON.stringify({type: "workerMessage", id: this.WORKER_ID, message: this.TEST_OBJECT}));
		
		test.ok(spy.calledWithMatch(this.TEST_OBJECT), "Worker message not emitted");

		test.done();
	},
	getWorker: function(test){
		var sendToSocketSpy = sinon.spy(this.workerProvider, 'sendToSocket');
		var callback = sinon.spy();
		this.workerProvider.available = false;
		this.workerProvider.getWorker({}, callback);

		test.ok(callback.calledWith(void 0), "Unavailable provider responded with worker");

		this.workerProvider.available = true;
		callback = sinon.spy();
		this.workerProvider.getWorker({}, callback);
		
		var WORKER_ID = sendToSocketSpy.lastCall.args[0].id;
		this.socket.eventEmitter.emit("message", JSON.stringify({type: "spawnedWorker", id: WORKER_ID}));

		test.strictEqual(callback.lastCall.args[0].id, WORKER_ID, "Callback not called with spawned worker");
		test.done();
	},
	removeWorker: function(test){
		var spy = sinon.spy();
		this.workerProvider.api.on('workerDead', spy);

		var worker = this.workerProvider.createWorker(this.WORKER_ID);

		this.workerProvider.removeWorker(this.WORKER_ID);

		test.ok(spy.calledOnce, "Worker death not emitted");

		test.done();
	}
};