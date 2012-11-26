var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createRemoteServer = require("../lib/remoteServer/server.js").create,
	createMinionMaster = require("../../").minionMaster.create;

var minionMaster = createMinionMaster();

var remoteServer = createRemoteServer(minionMaster, {logger:logger});
