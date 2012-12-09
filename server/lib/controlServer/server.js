var jot = require('json-over-tcp'),
	precondition = require('precondition');

var createClient = require('./client.js'),
	utils = require('../utils.js');

var create = module.exports = function(queen, options){
	precondition.checkDefined(queen, "ControlServer requires a queen instance");

	options = options || {};
	var netServer = options.server || jot.createServer().listen(options.port || 8099, options.host || "localhost"),
	server = new Server(queen, netServer);

	if(options.logger) server.log = options.logger;

	return server;
};

var connectionHandler = function(connection){
	createClient(connection, this.queen, {logger: this.log});
};

var Server = function(queen, netServer){
	this.netServer = netServer;
	this.queen = queen;

	this.netServer.on('connection', this.connectionHandler.bind(this));
};

Server.prototype.log = utils.noop;

Server.prototype.connectionHandler = function(connection){
	createClient(connection, this.queen, {logger: this.log});
};