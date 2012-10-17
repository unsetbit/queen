var webdriverjs = require("webdriverjs"),
	_ = require("underscore");

exports.create = create = function(host, captureUrl, options){
	var options = options || {},
		host = options.host || "localhost",
		port = options.port || 4444,
		captureUrl = options.captureUrl || "http://localhost/capture",
		browserProvider = new SeleniumBrowserProvider(host, port, captureUrl);

	return browserProvider;
};

exports.SeleniumBrowserProvider = SeleniumBrowserProvider = function(host, port, captureUrl){
	this._drivers = [];
	this._captureUrl = captureUrl;
	this._host = host;
	this._port = port;
	this._webdriverjs = webdriverjs;
};

SeleniumBrowserProvider.prototype.createBrowser = function(id, desiredCapabilities){
	var captureUrl = this._captureUrl,
		driver = this._webdriverjs.remote({logLevel:"silent", host: this._host, port: this._port ,desiredCapabilities: desiredCapabilities});
	
	driver.init();

	if(id !== void 0){
		captureUrl = captureUrl + "?minionId=" + id;
	}
	
	driver.url(captureUrl).getTitle(function(){});

	this._drivers.push(driver);
	return driver;
};

SeleniumBrowserProvider.prototype.killBrowser = function(driver, callback){
	var index = _.indexOf(this._drivers, driver);

	if(index > -1){
		this._drivers.splice(index, 1);
		driver.end(function(){
			if(_.isFunction(callback)){
				callback();
			}
		});
	} else { // driver not found exec callback now
		if(_.isFunction(callback)){
			callback();
		}
	}
};

SeleniumBrowserProvider.prototype._killBrowsers = function(callback){
	callback = callback || function(){};
	var self = this,
		drivers = this._drivers;

	var killedCount = 0;
	drivers.forEach(function(driver){
		driver.end(function(){
			killedCount++;
		});
	});

	(function waitForBrowsers(){
		if(killedCount !== drivers.length){
			return process.nextTick(waitForBrowsers);
		}
		self._drivers = [];
		if(_.isFunction(callback)){
			callback();	
		}
	}());
};

SeleniumBrowserProvider.prototype.kill = function(callback){
	this._killBrowsers(callback);
};