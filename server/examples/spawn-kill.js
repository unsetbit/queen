var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'debug'}) ]}),
	createMinionMaster = require("../../").minionMaster.create;

var minionMaster = createMinionMaster({	logger:logger });

// Spawn a browser then kill it once it's registered
var driver = minionMaster.spawnBrowser({browserName: "firefox"}, function(browser){
	minionMaster.kill(function(){
		process.exit(0);
	});
});