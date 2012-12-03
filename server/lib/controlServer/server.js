var jot = require('json-over-tcp'),
	precondition = require('precondition');

var createClient = require('./client.js'),
	utils = require('../utils.js');

var create = module.exports = function(minionMaster, options){
	precondition.checkDefined(minionMaster, "ControlServer requires a minion master instance");

	options = options || {};
	var netServer = options.server || jot.createServer().listen(options.port || 8099, options.hostname || "localhost"),
	server = new Server(minionMaster, netServer);

	if(options.logger) server.log = options.logger;

	return server;
};

var connectionHandler = function(connection){
	createClient(connection, this.minionMaster, {logger: this.log});
};

var Server = function(minionMaster, netServer){
	this.netServer = netServer;
	this.minionMaster = minionMaster;

	this.netServer.on('connection', this.connectionHandler.bind(this));
};

Server.prototype.log = utils.noop;

Server.prototype.connectionHandler = function(connection){
	createClient(connection, this.minionMaster, {logger: this.log});
};