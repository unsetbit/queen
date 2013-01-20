module.exports = {
	script: "http://queenjs.com/server-example.js"; // script to run on load
	populator: {
		type: "sauce",
		config: {
			username: "ozanturgut",
			accessKey: ""
		},
		clients: [
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "18"
			}
		]
	}
};