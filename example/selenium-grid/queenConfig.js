var script = "http://queenjs.com/server-example.js"; // script to run on load
var populators = [
	{
		type: "selenium",
		config: {
			host: 'localhost', 
			port: 4444
		},
		clients: [
			{ browserName: "firefox" }
		]
	}
];
