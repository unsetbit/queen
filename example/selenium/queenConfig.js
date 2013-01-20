module.exports = {
	script: require('../chance.js'),
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