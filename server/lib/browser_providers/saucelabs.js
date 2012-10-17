var webdriver = require('wd'),
	_ = require("underscore");

exports.create = create = function(username, apiKey, captureUrl){
	var options = options || {},
		browserProvider = new SauceLabsProvider(username, apiKey, captureUrl);

	return browserProvider;
};

exports.SauceLabsProvider = SauceLabsProvider = function(username, apiKey, captureUrl){
	this._drivers = [];
	this._username = username;
	this._apiKey = apiKey;
	this._captureUrl = captureUrl;
};

SauceLabsProvider.prototype.createBrowser = function(id, desiredCapabilities){
	var captureUrl = this._captureUrl,
		driver = webdriver.remote("ondemand.saucelabs.com", 80, username, apiKey);

	if(id !== void 0){
		captureUrl = captureUrl + "?minionId=" + id;
	}

	driver.init(desiredCapabilities, function() {
	  driver.get(captureUrl, function() {
	    driver.title(function(err, title) {
	      	//
	    })
	  })
	})

	this._drivers.push(driver);
	return driver;
};

SauceLabsProvider.prototype.killBrowser = function(driver, callback){
	var index = _.indexOf(this._drivers, driver);

	if(index > -1){
		this._drivers.splice(index, 1);
		driver.quit(function(){
			if(_.isFunction(callback)){
				callback();
			}
		})
	} else { // driver not found exec callback now
		if(_.isFunction(callback)){
			callback();
		}
	}
};

SauceLabsProvider.prototype._killBrowsers = function(callback){
	callback = callback || function(){};
	var self = this,
		drivers = this._drivers;

	var killedCount = 0;
	drivers.forEach(function(driver){
		driver.quit(function(){
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

SauceLabsProvider.prototype.kill = function(callback){
	this._killBrowsers(callback);
};