var _ = require('./lib/underscore.js'),
	utils = require('./utils.js');

window.iframeSockets = {};

exports.create = function(id, options){
	var worker = new IframeWorker(id);

	return worker.api;
};

var IframeWorker = function(id){
	this.id = id;

	this.iframe = document.createElement("IFRAME");
	this.iframe.className = "minion-master-worker";
	this.pendingMessages = [];

	document.body.appendChild(this.iframe);

	this.kill = _.once(_.bind(this.kill, this));
	this.start = _.once(_.bind(this.start, this));

	this.socket = new Socket();
	this.socket.onPostMessage = _.bind(this.postMessageFromWorker, this)
	window.iframeSockets[this.id] = this.socket.api;

	this.api = getApi.call(this);
};

var getApi = function(){
	var api = {
		id: this.id,
		onmessage: utils.noop,
		onDead: utils.noop,
		postMessage: this.socket.message,
		kill: this.kill,
		start: this.start
	};

	return api;
};

var Socket = function(){
	this.pendingMessages = [];
	this.message = this.message.bind(this);
	this.api = this.postMessage.bind(this);
	this.api.onmessage = utils.noop;
	this.ready = _.once(this.ready.bind(this));
};
Socket.prototype.onPostMessage = utils.noop;
Socket.prototype.isReady = false;
Socket.prototype.postMessage = function(message){
	this.onPostMessage(message);
};

Socket.prototype.ready = function(){
	this.isReady = true;
	_.each(this.pendingMessages, this.message);
};

Socket.prototype.message = function(message){
	if(this.isReady){
		this.api.onmessage({
			data: message,
			origin: window.location.origin,
			source: this
		});
	} else {
		this.pendingMessages.push(message);
	}
};

IframeWorker.prototype.postMessageFromWorker = function(message){
	this.api.onmessage(message);
};

IframeWorker.prototype.start = function(config){
	if(config.scripts !== void 0){
		this.runScripts(config.scripts);
	} else if(config.url !== void 0){
		this.loadUrl(config.url);
	} else { // config.script !== void 0
		this.runScripts([config.scriptPath]);
	}
};

IframeWorker.prototype.runScripts = function(scripts){
	var self = this,
		iframe,
		iframeDoc,
		iframeContent;

	iframe = this.iframe;


	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent = "<html><head><title></title></head><body>";
	iframeContent += "<script>window.socket = window.parent.iframeSockets['" + this.id + "'];</script>";
	_.each(scripts, function(script){
		iframeContent += '<script type="text/javascript" src="' + script + '"></script>';
	});
	iframeContent += "<script></script>";
	iframeContent += "</body></html>";

    if (iframe.attachEvent) {
      iframe.onreadystatechange = function () {
        if (self.iframe.readyState == 'complete') {
          self.socket.ready();
        }
      };
    } else {
      this.iframe.onload = this.socket.ready;
    }

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();


};

IframeWorker.prototype.loadUrl = function(url){
	var iframe = this.iframe;
	iframe.setAttribute("src", url + "?iframeSocketId=" + this.id); 
};

IframeWorker.prototype.kill = function(){
	delete window.iframeSockets[this.id];
	document.body.removeChild(this.iframe);	
	this.iframe = void 0;
	this.api.onDead();
};
