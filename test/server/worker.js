var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	workerModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../../lib/server/worker.js'));

exports.worker = {
	api: function(test){
		var callback = sinon.spy(),
			id = "1",
			provider = {},
			emitter = {
				on: sinon.spy(),
				removeListener: sinon.spy(),
				emit: sinon.spy(),
				removeAllListeners: sinon.spy()
			},
			onSendToSocket = sinon.spy();

		test.throws(function(){worker = workerModule.create()}, "Able to construct with invalid params");
		test.throws(function(){worker = workerModule.create(id)}, "Able to construct with invalid params");
		test.throws(function(){worker = workerModule.create(id, provider)}, "Able to construct with invalid params");
		test.throws(function(){worker = workerModule.create(id, provider, emitter)}, "Able to construct with invalid params");
		
		var worker = workerModule.create(id, provider, emitter, onSendToSocket);
		test.ok(worker !== void 0, "Unable to construct with valid params");

		test.ok(worker.id === id, "Id wasn't set correctly");
		test.ok(worker.provider === provider, "Provider wasn't set correctly");
		
		worker.on('test', callback);
		test.ok(emitter.on.calledWith('test', callback), "On function didn't relay call properly");

		worker.removeListener('test', callback);
		test.ok(emitter.removeListener.calledWith('test', callback), "Remove listener function didn't relay call properly");

		worker('hello, world');
		test.ok(onSendToSocket.calledWith('hello, world'), "Send to socked didn't relay message");

		worker.kill();
		test.ok(emitter.emit.calledWith('dead'), "Dead signal wasn't sent");
		test.ok(emitter.removeAllListeners.called, "Remove all signals wasn't called");
		
		test.done();
	}
};