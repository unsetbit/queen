var path = require('path');

exports.minionMaster = require('./server/lib/minionMaster.js');
exports.staticDir = path.resolve(path.dirname(module.filename), './client/static');