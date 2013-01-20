module.exports = {
	script: "http://queenjs.com/server-example.js"; // script to run on load
	populator: {
		type: "selenium",
		config: {
			host: 'localhost', 
			port: 4444
		},
		clients: [
			{ browserName: "firefox" }
		]
	}
};