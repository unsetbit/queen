var path = require('path');

exports.browser = require('./server/lib/browser.js');
exports.browserHub = require('./server/lib/browserHub.js');
exports.minionMaster = require('./server/lib/minionMaster.js');
exports.staticDir = path.resolve(path.dirname(module.filename), './client/static');