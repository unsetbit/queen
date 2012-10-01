var webdriverjs = require("webdriverjs"),
	_ = require("underscore");

exports.create = create = function(options){
	var options = options || {},
		gridHost = options.gridHost || "localhost",
		captureUrl = options.captureUrl || "http://localhost/capture",
		browserProvider = new SeleniumBrowserProvider(gridHost, captureUrl);

	if(options.desiredCapabilities){
		options.desiredCapabilities.forEach(function(desiredCapabilities){
			browserProvider.createSession(desiredCapabilities);
		});
	};

	return browserProvider;
};

exports.SeleniumBrowserProvider = SeleniumBrowserProvider = function(gridHost, captureUrl){
	this._drivers = [];
	this._captureUrl = captureUrl;
	this._gridHost = gridHost;
	this._webdriverjs = webdriverjs;
};

SeleniumBrowserProvider.prototype.createSession = function(desiredCapabilities, id, callback){
	var captureUrl = this._captureUrl,
		driver = this._webdriverjs.remote({logLevel:"silent", host: this._gridHost ,desiredCapabilities: desiredCapabilities});
	
	driver.init();

	if(id !== void 0){
		captureUrl = captureUrl + "?minionId=" + id;
	}
	
	driver.url(captureUrl).getTitle(function(){
		if(_.isFunction(callback)){
			callback();
		}
	});

	this._drivers.push(driver);
	return driver;
};

SeleniumBrowserProvider.prototype.killSession = function(driver, callback){
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

SeleniumBrowserProvider.prototype.killSessions = function(callback){
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
	this.killSessions(callback);
};