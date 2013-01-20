module.exports = {
	script: "http://queenjs.com/server-example.js", // script to run on load
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
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "17"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "16"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "15"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "14"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "13"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "12"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "11"
			},
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "10"
			}
		]
	}
};