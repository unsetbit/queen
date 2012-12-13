var _ = require('./external/underscore.js'),
	EventEmitter = require('./external/eventEmitter.js').EventEmitter,
	utils = require('./utils.js');

window.iframeSockets = {};

// Socket interfaced used to interact with the iframed worker
var Socket = function(){
	this.pendingMessages = [];
	this.message = this.message.bind(this);
	this.api = this.postMessage.bind(this);
	this.api.onMessage = utils.noop;
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
		this.api.onMessage(message);
	} else {
		this.pendingMessages.push(message);
	}
};

exports.create = function(id, options){
	var worker = new IframeWorker(id);

	return worker;
};

var IframeWorker = function(id){
	this.id = id;

	this.iframe = document.createElement("IFRAME");
	this.iframe.className = "queen-worker";

	document.body.appendChild(this.iframe);

	this.kill = _.once(_.bind(this.kill, this));
	this.start = _.once(_.bind(this.start, this));
	this.emitter = new EventEmitter();

	this.socket = new Socket();
	this.socket.onPostMessage = _.bind(this.postMessageFromWorker, this)
	this.socket.api.kill = this.kill;
	window.iframeSockets[this.id] = this.socket.api;
	this.postMessage = this.socket.message;
	this.api = getApi.call(this);
};

var getApi = function(){
	var api = {};

	api.id = this.id;
	api.on = _.bind(this.emitter.on, this.emitter);
	api.removeListener = _.bind(this.emitter.removeListener, this.emitter);
	kill = this.kill;

	return api;
};

IframeWorker.prototype.postMessageFromWorker = function(message){
	this.emitter.emit('message', message);
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
	this.emitter.emit('dead');
};
