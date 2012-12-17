var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	createQueen = require("../");

// the example
var	queen = createQueen({logger:logger.info.bind(logger)});

queen({
	scripts: ['http://localhost/example/ping.js'],
	populate: "continuous",
	killOnStop: false
});
