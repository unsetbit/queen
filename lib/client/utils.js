exports.noop = function(){};

// by Artem Barger from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
var getParameterByName = exports.getParameterByName = function(name){
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if(results == null)	return "";
	else return decodeURIComponent(results[1].replace(/\+/g, " "));
}

/* These don't follow good security practices, but it's OK for Queen, just don't use this
	in other projects without added security in */
// Modified from Ben Alman's code for jQuery postMessage, license: http://benalman.com/about/license/

if(window.postMessage){
	(function(){
		var lastSentMessage;

		exports.postMessage = function(message, target, targetUrl){
			if(!target){
				target = parent
				lastSentMessage = message;
			};
			target.postMessage(message, "*");
		};

		exports.onMessage = function(callback){
			function messageHandler(e){
				if(e.data === lastSentMessage) return;
				callback(e.data);
			}

			if(window.addEventListener){
				window.addEventListener("message", messageHandler, false);
			} else {
				window.attachEvent("onmessage", messageHandler);
			}
		};
	}());
} else {
	(function(){
		var onMessageInterval,
			ON_MESSAGE_POLLING_INTERVAL = 100,
			previousHash = "",
			onMessageCleanRe = /^#?\d+&/,
			postMessageCleanRe = /#.*$/;

		exports.postMessage = function(message, target, targetUrl){
			var hash = "#" + (+new Date) + "&" + message;
			if(!target){
				target = parent;
				previousHash = hash;
			}
			if(!targetUrl){
				targetUrl = getParameterByName('parentUrl');
			}

			target.location = targetUrl.replace(postMessageCleanRe,"") + hash;
		};

		exports.onMessage = function(callback){
			onMessageInterval && clearInterval(onMessageInterval);
			onMessageInterval = setInterval(function(){
				var hash = window.document.location.hash;
				if (hash !== previousHash && onMessageCleanRe.test(hash) ) {
					previousHash = hash;
					callback(hash.replace(onMessageCleanRe, ""));
				}
			}, ON_MESSAGE_POLLING_INTERVAL);
		};
	}());
}

(function(){
	if (window.XMLHttpRequest) {              
	    exports.getHtml = function(url, callback){
			var xhr =new XMLHttpRequest();              
			xhr.open("GET", url, true);
			xhr.onload = function(e) {
			  callback(xhr.responseText);
			};
			xhr.send();
		};
	} else {
	    exports.getHtml = function(url, callback){
	    	var xhr;
	    	try {
				xhr = new ActiveXObject("Msxml2.XMLHTTP");
			} 
			catch (e) {
				try {
			  		xhr = new ActiveXObject("Microsoft.XMLHTTP");
				}
				catch (e) {
					callback("");
					return;
				}
			}
	    	xhr.onreadystatechange = function(){
	      		if(ajax.readyState === 4){
		      		callback(ajax.responseText);
		      	}
	    	}
	    	xhr.open('GET', url);
    		xhr.send();
	    }; 
	};
}());