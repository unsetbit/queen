var capture = "localhost";// capture server host

var populators, // array of populators to use 
	heartbeatInterval, // seconds a client has to send a heartbeat until deemed unresponsive
	quiet, // don't log anything
	verbose, // log out debugging info to console
	script = "http://queenjs.com/server-example.js", // script to run on load
	host; // remote server host

populators = [
	{
		type: "selenium",
		config: {
			host: 'localhost', 
			port: 4445	
		},
		clients: [
			{ browserName: "firefox" }
		]
	}/*,
	{
		type: "sauce",
		config: {
			username: "ozanturgut",
			accessKey: ""
		},
		clients: [
			{ 
				browserName: "ipad",
				platform: "Mac 10.8",
				version: "5.1"
			}
		]
	},/*
	{
		type: "browserstack",
		config: {
			username: "ozanturgut@gmail.com",
			password: "",
			version: 2
		},
		clients: [
			{ 
				browser: "firefox",
				version: "11.0",
				os: "win"
			}
		]
	}*/
];
