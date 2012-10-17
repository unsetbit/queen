var path = require('path');

exports.browser = require('./server/lib/browser.js');
exports.browserHub = require('./server/lib/browserHub.js');
exports.minionMaster = require('./server/lib/minionMaster.js');
exports.seleniumBrowserProvider = require('./browser_providers/selenium.js');
exports.saucelabsBrowserProvider = require('./browser_providers/saucelabs.js');
exports.staticDir = path.resolve(path.dirname(module.filename), './client/static');