var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	workforceModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../../lib/server/workforce.js'));

var create = workforceModule.create;
var Workforce = workforceModule.Workforce;

var createMockWorker = function(){
	var worker = sinon.spy();
	
	worker.eventEmitter = new EventEmitter();
	worker.on = sinon.spy(worker.eventEmitter.on.bind(worker.eventEmitter));
	worker.removeListener = sinon.spy(worker.eventEmitter.removeListener.bind(worker.eventEmitter));
	worker.kill = sinon.spy(function(){worker.eventEmitter.emit('dead')});

	return worker;
};

exports.workforce = {
	setUp: function(callback){
		this.workforce = create({});
		this.TEST_STRING = "Hello, world";
		callback();
	},
	create: function(test){
		var workforce;
		test.throws(function(){workforce = create()}, "Able to construct with missing required params");
		
		workforce = create({});
		test.ok(workforce instanceof Workforce, "Unable to construct with valid params");

		workforce = create({}, {});
		test.ok(workforce instanceof Workforce, "Unable to construct with valid params and options");

		workforce = create({}, {
			stopHandler: function(){},
			workerHandler: function(){},
			providerFilter: function(){}
		});
		test.ok(workforce instanceof Workforce, "Unable to construct with valid params and options");

		test.done();
	},
	construct: function(test){
		var workforce;
		test.throws(function(){workforce = new Workforce()}, "Able to construct with missing required params");
		
		workforce = new Workforce({});
		test.ok(workforce instanceof Workforce, "Unable to construct with valid params");

		test.done();
	},
	broadcast: function(test){
		var self = this;
		test.doesNotThrow(function(){self.workforce.broadcast(this.TEST_STRING);}, "Broadcasting without worker doesn't succeed");

		var worker = createMockWorker();
		var workerProvider = sinon.stub().callsArgWith(1, worker);

		this.workforce.populate(workerProvider);
		this.workforce.broadcast(this.TEST_STRING);
		test.ok(worker.calledWith(this.TEST_STRING), "Worker was not included in broadcast message");
		test.done();
	},
	addWorker: function(test){
		var workerHandlerSpy = sinon.spy(this.workforce, "workerHandler");
		
		test.throws(function(){this.workforce.addWorker();}, "Adding an undefined worker succeeded");
		test.throws(function(){this.workforce.addWorker({});}, "Adding an non-function worker succeeded");

		var worker = createMockWorker();

		this.workforce.addWorker(worker);
		test.equal(this.workforce.workers.length, 1, "Worker wasn't added");
		test.ok(workerHandlerSpy.calledWith(worker), "Worker handler not called");

		emitterSpy = sinon.spy(this.workforce.emitter, 'emit');
		worker.eventEmitter.emit('message', this.TEST_STRING);
		test.ok(emitterSpy.calledWith('message', this.TEST_STRING, worker), "Worker message wasn't relayed");

		worker.kill();
		test.equal(this.workforce.workers.length, 0, "Dead worker not removed");

		test.done();
	},
	kill: function(test){
		var deadSpy = sinon.spy();
		this.workforce.api.on('dead', deadSpy);

		var worker = createMockWorker();

		this.workforce.addWorker(worker);
		
		this.workforce.kill();
		test.ok(worker.kill.calledOnce, "Worker not killed");
		test.equals(this.workforce.workers.length, 0, "Workers not removed");
		test.ok(deadSpy.calledOnce, "Dead event listener not called");

		test.done();
	},
	stop: function(test){
		var stopHandler = sinon.spy();

		var worker = createMockWorker();
		this.workforce.addWorker(worker);
		
		this.workforce.stop();
		
		test.ok(worker.kill.calledOnce, "Worker not killed");
		test.equals(this.workforce.workers.length, 0, "Workers not removed");
		
		test.done();
	},
	stopHandler: function(test){
		var stopSpy = sinon.spy(this.workforce, "stopHandler");

		var worker = createMockWorker();
		this.workforce.addWorker(worker);
		this.workforce.stop();
		
		test.ok(stopSpy.calledOnce, "Stop handler not called");

		test.done();
	},
	killOnStop: function(test){
		var workforce = workforceModule.create({}, {
			killOnStop: false
		});

		var deadSpy = sinon.spy();
		workforce.api.on('dead', deadSpy);

		var worker = createMockWorker();
		workforce.addWorker(worker);
		
		workforce.stop();
		test.ok(!deadSpy.called, "Dead event listener called");
		
		// when true
		workforce = workforceModule.create({}, {
			killOnStop: true
		});
		
		workforce.api.on('dead', deadSpy);

		var worker = createMockWorker();
		workforce.addWorker(worker);

		workforce.stop();
		test.ok(deadSpy.called, "Dead event listener not called");
		test.done();
	},
	populate: function(test){
		var WORKER_CONFIG = {};
		this.workforce = create(WORKER_CONFIG);
		var stopSpy = sinon.spy(this.workforce, "stopHandler");
		var worker = createMockWorker();
		var workerProvider = sinon.stub().callsArgWith(1, worker);
		
		this.workforce.populate(workerProvider);

		test.ok(workerProvider.calledWith(WORKER_CONFIG), "Worker config not sent do worker provider");
		test.equals(this.workforce.workers.length, 1, "Worker not added");
		test.ok(!stopSpy.called, "Stop was called");

		// When worker provider unavailable
		this.workforce = create(WORKER_CONFIG);
		stopSpy = sinon.spy(this.workforce, "stopHandler");
		workerProvider = sinon.stub().callsArgWith(1, void 0);
		this.workforce.populate(workerProvider);

		test.equals(this.workforce.workers.length, 0, "Worker added from unavailable worker provider");
		test.ok(stopSpy.called, "Stop was not called");
		test.done();
	},
	providerFilter: function(test){
		var worker;
		var filterSpy = sinon.spy(this.workforce, "providerFilter");
		var workerProvider = sinon.spy();

		this.workforce.populate(workerProvider);
		test.ok(filterSpy.calledWith(workerProvider.attributes), "Filter called with worker provider");

		// Positive case
		this.workforce = create({}, {
			providerFilter: function(){return false;}
		});
		
		worker = createMockWorker();
		workerProvider = sinon.stub().callsArgWith(1, worker);
		this.workforce.populate(workerProvider);
		test.equals(this.workforce.workers.length, 0, "Worker added when filter returned false");

		// Negative case
		this.workforce = create({}, {
			providerFilter: function(){return true;}
		});
		
		worker = createMockWorker();
		workerProvider = sinon.stub().callsArgWith(1, worker);
		this.workforce.populate(workerProvider);
		test.equals(this.workforce.workers.length, 1, "Worker not added when filter returned true");
		test.done();
	}
};