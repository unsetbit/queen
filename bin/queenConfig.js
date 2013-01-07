var populators, // array of populators to use
	autoSpawn, // array of browsers to automatically spawn with populators
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
		}
	},
	{
		type: "sauce",
		config: {
			username: "ozanturgut",
			accessKey: "71dd81a2-1ff4-474a-be88-26fcb9be8bb3"
		}
	}*/
];

autoSpawn = [
	{
		browserName: "firefox"
	}
];
