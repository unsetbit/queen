var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]});
	
// init queen
var	createQueen = require("../"),
	queen = createQueen({logger:logger.info.bind(logger)});

// init remote server
var createRemoteServer = require('../../queen-remote').server,
	controlServer = createRemoteServer(queen);