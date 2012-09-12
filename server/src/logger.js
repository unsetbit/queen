
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var toArray = function (enu) {
  var arr = [];

  for (var i = 0, l = enu.length; i < l; i++)
    arr.push(enu[i]);

  return arr;
};

/**
 * Log levels.
 */

var levels = [
    'error'
  , 'warn'
  , 'info'
  , 'debug' 
  , 'trace'
];

/**
 * Colors for log levels.
 */

var colors = [
    31
  , 33
  , 36
  , 90
  , 37
];

exports.defaults = defaults = {
  threshold : 4,
  enabled: true
};

function bold(str){
  return '\x1B[1m' + str + '\x1B[22m';
}

/**
 * Pads the nice output to the longest log level.
 */

function pad (str) {
  var max = 0;

  for (var i = 0, l = levels.length; i < l; i++)
    max = Math.max(max, levels[i].length);

  if (str.length < max)
    return str + new Array(max - str.length + 1).join(' ');

  return str;
};

/**
 * Logger (console).
 *
 * @api public
 */

var Logger = function (opts) {
  opts = opts || {}
  opts.enabled = opts.enabled === void 0 ?  defaults.enabled  : opts.enabled;
  opts.threshold = opts.threshold === void 0 ? defaults.threshold : opts.threshold;

  this.colors = false !== opts.colors;
  this.threshold = opts.threshold;
  this.enabled = opts.enabled;
  this.prefix = opts.prefix;
};

exports.create = function(opts){
  return new Logger(opts);
};

/**
 * Log method.
 *
 * @api public
 */

Logger.prototype.log = function (type) {
  var index = levels.indexOf(type);
  if (index > this.threshold || !this.enabled){
    return this;
  }

  var messageArray = [this.colors ? ' \033[' + colors[index] + 'm' + pad(type) + ' -\033[39m' : type + ':'];
  if(this.prefix){
    messageArray = messageArray.concat([ bold("[" + this.prefix + "]")]);
  }

  messageArray = messageArray.concat(toArray(arguments).slice(1));
  console.log.apply(console, messageArray);

  return this;
};

/**
 * Generate methods.
 */

levels.forEach(function (name) {
  Logger.prototype[name] = function () {
    this.log.apply(this, [name].concat(toArray(arguments)));
  };
});