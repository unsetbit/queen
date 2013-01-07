var populators, // array of populators to use
	capturePort, // capture server port
	captureHost, // capture server host
	heartbeatInterval, // seconds a client has to send a heartbeat until deemed unresponsive
	quiet, // don't log anything
	verbose, // log out debugging info to console
	script, // script to run on load
	noRemote, // set to true disable remotoe connetions
	port, // remote server port
	host; // remote server host

populators = [
	/*{
		type: "selenium",
		config: {
			host: 'localhost', 
			port: 4445	
		},
		clients: [
			{ browserName: "firefox" }
		]
	},
	{
		type: "sauce",
		config: {
			username: "ozanturgut",
			accessKey: "123"
		},
		clients: [
			{ browserName: "firefox" }
		]
	},*/
	{
		type: "browserstack",
		config: {
			username: "ozanturgut@gmail.com",
			password: "123",
			version: 2
		},
		clients: [
			{ browser: "firefox" }
		]
	}
];
