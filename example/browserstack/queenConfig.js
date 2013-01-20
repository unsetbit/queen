module.exports = {
	script: "http://queenjs.com/server-example.js"; // script to run on load
	populator: {
		type: "browserstack",
		config: {
			username: "ozanturgut@gmail.com",
			password: "[YOUR PASSWORD HERE]",
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
};