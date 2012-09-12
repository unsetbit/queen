var createMinionMaster = require('../src/minionMaster.js').create;
var socketio = require("socket.io");
var webServer = require("../src/webServer.js");
var logger = require("../src/logger.js");

var server = webServer.create("80", "../../client");

logger.defaults.threshold =  4
var socketioServer = socketio.listen(server, {
	logger: logger.create({prefix:'socket.io', threshold:0})
});

var mm = createMinionMaster(socketioServer);
