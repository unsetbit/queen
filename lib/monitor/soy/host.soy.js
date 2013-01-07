// This file was automatically generated from host.soy.
// Please don't edit this file by hand.

if (typeof module == 'undefined') { var module = {}; }
if (typeof module.exports == 'undefined') { module.exports = {}; }


module.exports.helloName = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append((! opt_data.greetingWord) ? 'Hello ' + soy.$$escapeHtml(opt_data.name) + '!' : soy.$$escapeHtml(opt_data.greetingWord) + ' ' + soy.$$escapeHtml(opt_data.name) + '!');
  return opt_sb ? '' : output.toString();
};
