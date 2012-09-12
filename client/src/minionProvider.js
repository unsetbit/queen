define(function(require, exports, module) {
    require('/socket.io/socket.io.js');
	var minionCreator = require('/src/minion.js').create;
	var extend = require('/lib/utils.js').extend;
	
	var mockLog = function(arg){
		if(console && console.log){
			console.log(arg);	
		}
	}
	var mockLogger = {
		info: mockLog,
		trace: mockLog,
		log: mockLog,
		debug: mockLog,
		error: mockLog,
		warn: mockLog
	};

	exports.create = function(path){
		var socket = io.connect(path);
		var minionProvider = new BrowserMinionProvider();
		
		socket.emit("setAttributes", minionProvider.getAttributes());
		socket.on("createMinion", function(data){
			var minionSocket = socket.connect("/minion/" + data.socketId);
			var minion = minionProvider.createMinion(minionSocket, data.data);
			minionSocket.on("disconnect", function(){
				minion.kill();
			});
		});
	};

	exports.BrowserMinionProvider = BrowserMinionProvider = function(){
		var self = this;

		this._minions = [];
		this._logger = mockLogger;

		this._logger.trace("Created");		
	};

	BrowserMinionProvider.prototype.isConnectedToMinion = function(minion){
		return this._minions.indexOf(minion) !== -1;
	};

	BrowserMinionProvider.prototype.createMinion = function(emitter, data){
		var minion = minionCreator(emitter, data);
		minion.on("dead", function(){
			this.disconnectMinion(minion);
		});

		this.connectMinion(minion);
		
		this._logger.debug("Created minion");
		return minion;
	};

	BrowserMinionProvider.prototype.connectMinion = function(minion){
		if(!this.isConnectedToMinion(minion)){
			this._minions.push(minion);
			this._logger.debug("Connected minion");
		}
	};

	BrowserMinionProvider.prototype.disconnectMinion = function(minion){
		var index = this._minions.indexOf(minion);
		if(index !== -1){
			this._minions.splice(index, 1);	
			this._logger.debug("Disconnected minion");
		}
	};

	BrowserMinionProvider.prototype.defaultAttributes = {
		availableOnRegister: true
	};

	BrowserMinionProvider.prototype.getAttributes = function(){
		var attributes = extend({}, this.defaultAttributes);
		_.each(Modernizr, function(value, key){
			if(!_.isFunction(value) && !_.isArray(value) && key !== "_version"){
				attributes[key] = value;
			}
		});

		return attributes;
	};

	return exports;
});