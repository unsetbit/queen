var path = require('path');

exports.client = require('./server/lib/client.js');
exports.clientHub = require('./server/lib/clientHub.js');
exports.minionMaster = require('./server/lib/minionMaster.js');
exports.staticDir = path.resolve(path.dirname(module.filename), './client/static');