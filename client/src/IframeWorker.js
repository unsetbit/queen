var _ = require('./lib/underscore.js');

exports.create = function(id, onSendToSocket, options){
	var self = {
		id: id,
		sendToSocket: onSendToSocket,
		iframe: document.createElement("IFRAME"),
		runScripts: runScripts,
		runScript: runScript,
		loadUrl: loadUrl,
		pendingMessages: [],
		onDead: options.onDead || function(){}
	};

	_.bindAll(self);

	self.api = getApi.call(self);

	document.body.appendChild(self.iframe);

	return self.api;
};

var getApi = function(){
	var api = this.sendToSocket;
	api.id = this.id;
	api.onmessage = _.bind(addToPendingMessages, this);
	api.kill = _.once(_.bind(kill, this));
	api.start = _.once(_.bind(start, this));
	api.ready = _.once(_.bind(ready, this));

	return api;
};

var addToPendingMessages = function(message){
	this.pendingMessages.push(message);
};

var ready = function(){
	var self = this;
	_.each(this.pendingMessages, function(message){
		self.api.onmessage(message);
	});
};

var start = function(config){
	if(config.scripts !== void 0){
		this.runScripts(config.scripts);
	} else if(config.url !== void 0){
		this.loadUrl(config.url);
	} else { // config.script !== void 0
		this.runScript(config.script);
	}
};

var runScript = function(script){
		var iframe,
		iframeDoc,
		iframeContent;

	iframe = this.iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent =  "<html><head><title></title></head><body>";
	iframeContent += "<script>window.workerSocket = window.parent.GetWorkerSocket('" + this.id + "')</script>";
	iframeContent += "<script>" + script + "</script>";
	iframeContent += "<script>window.workerSocket.ready()</script>";
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

var runScripts = function(scripts){
	var iframe,
		iframeDoc,
		iframeContent;

	iframe = this.iframe;
	iframeDoc = (iframe.contentDocument) ? iframe.contentDocument : iframe.contentWindow.document;
	
	iframeContent = "<html><head><title></title></head><body>";
	iframeContent += "<script>window.workerSocket = window.parent.GetWorkerSocket('" + this.id + "')</script>";
	_.each(scripts, function(script){
		iframeContent += '<script src="' + script + '"><\/script>';
	});
	iframeContent += "<script>window.workerSocket.ready()</script>";
	iframeContent += "</body></html>";

	iframeDoc.open();
	iframeDoc.write(iframeContent);
	iframeDoc.close();
};

var loadUrl = function(url){
	var iframe = this.iframe;
	iframe.setAttribute("src", url + "?iframeWorkerId=" + this.id); 
};

var kill = function(){
	document.body.removeChild(this.iframe);	
	this.iframe = void 0;
	this.onDead();
};
