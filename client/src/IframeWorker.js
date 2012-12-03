var _ = require('./lib/underscore.js'),
	utils = require('./utils.js');

window.iframeSockets = {};

exports.create = function(id, options){
	var worker = new IframeWorker(id);

	if(options.onDead) worker.onDead = options.onDead;
	return worker.api;
};

var IframeWorker = function(id){
	this.id = id;

	this.iframe = document.createElement("IFRAME");
	this.pendingMessages = [];

	document.body.appendChild(this.iframe);

	this.kill = _.once(_.bind(this.kill, this));
	this.start = _.once(_.bind(this.start, this));
	this.ready = _.once(_.bind(this.ready, this));

	this.socket = new Socket();
	this.socket.onPostMessage = _.bind(this.postMessageFromWorker, this)

	window.iframeSockets[this.id] = this.socket;

	this.api = getApi.call(this);
};

var getApi = function(){
	var api = {
		id: this.id,
		onmessage: utils.noop,
		postMessage: this.socket.message,
		kill: this.kill,
		start: this.start
	};

	return api;
};

var Socket = function(){
	this.pendingMessages = [];
	this.message = this.message.bind(this);
	this.postMessage = this.postMessage.bind(this);
};
Socket.prototype.onmessage = utils.noop;
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
		this.onmessage({
			data: message,
			origin: window.location.origin,
			source: this
		});
	} else {
		this.pendingMessages.push(message);
	}
};

IframeWorker.prototype.onDead = utils.noop;

IframeWorker.prototype.addToPendingMessages = function(message){
	this.pendingMessages.push(message);
};

IframeWorker.prototype.ready = function(){
	var self = this;

	_.each(this.pendingMessages, function(message){
		self.api.onmessageToWorker(message);
	});
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
		this.runScript(config.script);
	}
};

IframeWorker.prototype.runScript = function(script){
		var iframe,
		iframeDoc,
		iframeContent;

	iframe = this.iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent =  "<html><head><title></title></head><body>";
	iframeContent += "<script>window.iframeSocket = window.parent.iframeSockets['" + this.id + "'];</script>";
	iframeContent += "<script>postMessage = iframeSocket.postMessage</script>";
	iframeContent += "<script>" + script + "</script>";
	iframeContent += "<script>window.iframeSocket.onmessage = function(message){onmessage(message);}</script>";
	iframeContent += "<script>window.iframeSocket.ready()</script>";
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

IframeWorker.prototype.runScripts = function(scripts){
	var iframe,
		iframeDoc,
		iframeContent;

	iframe = this.iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent = "<html><head><title></title></head><body>";
	iframeContent += "<script>window.iframeSocket = window.parent.iframeSockets['" + this.id + "'];</script>";
	iframeContent += "<script>postMessage = iframeSocket.postMessage</script>";
	_.each(scripts, function(script){
		iframeContent += '<script src="' + script + '"><\/script>';
	});
	iframeContent += "<script>window.iframeSocket.onmessage = function(message){onmessage(message);}</script>";
	iframeContent += "<script>window.iframeSocket.ready()</script>";
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

IframeWorker.prototype.loadUrl = function(url){
	var iframe = this.iframe;
	iframe.setAttribute("src", url + "?iframeWorkerId=" + this.id); 
};

IframeWorker.prototype.kill = function(){
	delete window.iframeSockets[this.id];
	document.body.removeChild(this.iframe);	
	this.iframe = void 0;
	this.onDead();
};
