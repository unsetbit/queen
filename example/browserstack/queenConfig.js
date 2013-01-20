var script = "http://queenjs.com/server-example.js"; // script to run on load
var capture = "localhost:9300";
var populators = [
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
	}
];
