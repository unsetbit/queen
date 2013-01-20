var path = require('path');

var exports = module.exports = require('./lib/server/queen.js');
exports.queen = exports;
exports.runner = require('./lib/server/runner.js');
exports.protocol = require('./lib/protocol.js');

exports.WEB_ROOT = path.resolve(path.dirname(module.filename), './static');
