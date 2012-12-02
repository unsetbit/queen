var jot = require('json-over-tcp'),
	precondition = require('precondition');

var createClient = require('./client.js'),
	utils = require('../../utils.js');

var create = module.exports = function(minionMaster, options){
	precondition.checkDefined(minionMaster, "ControlServer requires a minion master instance");

	options = options || {};

	var server = options.server || jot.createServer().listen(options.port || 8099, options.hostname || "localhost");
	var self = {
		minionMaster: minionMaster,
		server: server,
		log: options.logger || utils.noop
	};

	server.on("connection", connectionHandler.bind(self));

	return server;
};

var connectionHandler = function(connection){
	var client = createClient(connection, this.minionMaster, {logger: this.log});
};