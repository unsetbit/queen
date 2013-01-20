module.exports = {
	script: require('../chance.js'), // script to run on load
	populator: {
		type: "sauce",
		config: {
			username: "[YOUR USER NAME]",
			accessKey: "[YOUR API ACCESS KEY]"
		},
		clients: [
			{ 
				browserName: "firefox",
				platform: "Windows 2003",
				version: "15"
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
			}/*,
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
			}*/
		]
	}
};