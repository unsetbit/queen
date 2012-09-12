var createLogger = require("./logger.js").create;
var _ = require("underscore");
var createBrowserMinionProvider = require("./browserMinionProvider").create;

exports.create = function(socketServer){
	var minionMaster = new MinionMaster();
	socketServer.on("connection", function(socket){
		var minionProvider = createBrowserMinionProvider(socket);
		minionMaster.connectMinionProvider(minionProvider);
		socket.on("disconnect", function(){
			minionMaster.disconnectMinionProvider(minionProvider);
		});
	});

	return minionMaster;
};

var idCounter = 0;
exports.MinionMaster = MinionMaster = function(){
	var self = this;
	this._minionProviders = [];	
	this._id = idCounter++;

	this._logger = createLogger({prefix: "MinionMaster-" + this._id });
	this._logger.trace("Created");
};

MinionMaster.prototype.getMinions = function(minionFilters){
	if(!_.isArray(minionFilterGroups)){
		minionFilterGroups = [minionFilterGroups];
	}

	var minions = [];

	this._minionProviders.forEach(function(minionProvider){
		var filterMatch = _.any(minionFilters, function(minionFilter){
			var minionAttributes = minionProvider.getAttributes();
			return isSimilar(minionFilter, minionAttributes);
		});

		if(filterMatch){
			var minion = minionProvider.getMinion();
			minions.push(minion);
		}
	});

	return minions;
};

MinionMaster.prototype.hasMinionProvider = function(minionProvider){
	return this._minionProviders.indexOf(minionProvider) !== -1;
};

MinionMaster.prototype.connectMinionProvider = function(minionProvider){
	if(!this.hasMinionProvider(minionProvider)){
		this._minionProviders.push(minionProvider);	
		this._logger.debug("A minion provider connected");
	}
};

MinionMaster.prototype.disconnectMinionProvider = function(minionProvider){
	var index = this._minionProviders.indexOf(minionProvider);
	if(index !== -1){
		this._minionProviders.splice(index, 1);	
		this._logger.debug("A minion provider disconnected");
	}
};
