// This file was automatically generated from WorkerProvider.soy.
// Please don't edit this file by hand.

if (typeof module == 'undefined') { var module = {}; }
if (typeof module.exports == 'undefined') { module.exports = {}; }


module.exports.WorkerProvider = function(opt_data, opt_sb) {
  var output = opt_sb || new soy.StringBuilder();
  output.append('\t<div class="host-wrapper"><div class="host ', (opt_data.unresponsive) ? 'host-unresponsive' : (opt_data.unavailable) ? 'host-unavailable' : '', '"><div class="name" title="', soy.$$escapeHtml(opt_data.name), '">', soy.$$escapeHtml(opt_data.family), ' ', soy.$$escapeHtml(opt_data.majorVersion), '</div><div class="platform">', soy.$$escapeHtml(opt_data.platform), '</div><div class="details"><div class="icon">');
  switch (opt_data.family) {
    case 'Chrome':
      output.append('<img src="./image/chrome.png" />');
      break;
    case 'Opera':
      output.append('<img src="./image/opera.png" />');
      break;
    case 'Firefox':
      output.append('<img src="./image/firefox.png" />');
      break;
    case 'Safari':
      output.append('<img src="./image/safari.png" />');
      break;
    case 'IE':
      switch (opt_data.majorVersion) {
        case '6':
        case '7':
          output.append('<img src="./image/ie6.png" />');
          break;
        case '8':
          output.append('<img src="./image/ie8-700.png" />');
          break;
        case '9':
          output.append('<img src="./image/ie-256.png" />');
          break;
        default:
          output.append('<img src="./image/ie-256.png" />');
      }
      break;
    default:
      output.append('<img src="./image/opera.png" />');
  }
  output.append('</div><div class="workerCount">', soy.$$escapeHtml(opt_data.workerCount), '</div></div></div></div>');
  return opt_sb ? '' : output.toString();
};
