# Queen [![Build Status](https://secure.travis-ci.org/ozanturgut/queen.png?branch=master)](http://travis-ci.org/ozanturgut/queen)

**A platform for running scripts on many browsers.**

Queen is a web server which is capable of brokering socketed communication between browsers which are connected to it
and server-side scripts. You can think of the Queen Server as a pool of browsers which you can execute code on. Taking
the abstraction further, you can think of Queen Server as distributed execution platform using browsers as computation
nodes.

## Explanation by Example
Let's say you want to play a game where you write down a number and others try to guess it. 
To make it easier, you give the players a maximum number when starting. You gather a bunch of friends, 
explain the rules, and give the maximum number. Your friends then yell out random numbers between 0 and the 
maximum number until you hear the right number.

Now imagine your friends are browsers, and the game is a script which tells browsers how to play, 
gives them a maximum number, and waits for one of them to guess the right number. 
This makes you the Queen Server.

Here is how to make this example a reality:

1. Install [Node.js](http://nodejs.org/).
2. In your terminal, run: `npm install -g queen` (use sudo on mac and linux).
3. Run: `queen -c *:9300 http://queenjs.com/server-example.js`
4. [Click here](http://localhost:9300/capture.html) and watch your terminal.

Here's what happened:

1. You installed software that allows you to run code on a JavaScript engine through the command line.
2. You installed queen.
3. You asked queen to start capturing browsers on port 9300 and then download and run a server-side queen script.
4. You pointed your browser to the queen server, allowing queen to push code that the server-side script requested to run on browsers (the "client-side script"). This client-script then started reporting back to the server-side script random number guesses. Once the server-side script saw the correct number, it ended the process.

## Features
* Bidirectional communication between your client-side and server-side script (using socket.io).
* Run scripts via command line, configuration file, or import Queen into your own project as a library.
* Target connected browsers based on user-agent or Modernizr capabilities.
* Connect browsers automatically using Selenium, BrowserStack, or SauceLabs.
* Run scripts on browsers connected to a central Queen server remotely using a thin-client (queen-remote).
* Automatically detects and recovers unresponsive browsers.
* Can run lists of scripts or an HTML files.

## Browser Support
Queen uses (Socket.io) for server-client communication, Socket.io supports IE5.5+, which is the same goal for Queen.

## Queen Scripts
You need two scripts to run queen: a client-side script which will run on browsers, and a server-side script which all
of the client-side scripts will communicate with. Here's an example of two such scripts:

```javascript
// http://queenjs.com/ping-client.js

// queenSocket is a global variable queen injects in 
// to this context

// The queenSocket.onMessage hook executes whenever the server-side script
// sends a message.
queenSocket.onMessage = function(number){
	// Wait one second, then send the number + 1 back
	// to the server-side script
	setTimeout(function(){
		// Sending something in to the queenSocket function sends 
		// it to the server-side script
		queenSocket(number + 1);
	}, 1000);
};
```

```javascript
// http://queenjs.com/ping-server.js
var config = {
	run: ['http://queenjs.com/ping-client.js'],
	
	// This tells queen to run this script on any
	// browsers which are connected now and in the future
	populate: "continuous", 
	
	// By default, queen will kill a workforce (i.e. this job)
	// if there are no browsers connected, this tells queen
	// that it's ok to idle and wait for browsers to connect.
	killOnStop: false,
	
	// This function gets called right before a browser starts 
	// running the client script.
	handler: function(worker){ 
		// Worker can be thought of as the browser.
		worker.on('message', function(num){
			console.log(worker.provider + " is at " + num);
			
			// If the browser has pinged us 10 times, kill it.
			if(num === 10){
				worker.kill();
			} else {
				// Echo the number back to the worker
				worker(num);
			}
		});
	
		// Tell the worker to start at 0
		worker(0);
	}
}

// queen is a global variable of the running queen instance
queen(config);
```

To run this example, run this command in your terminal: `queen -c *:9300 http://queenjs.com/ping-server.js`. 
This tells queen to run the server script, and listen for browsers on port 9300. Now if you navigate to
[http://localhost:9300/capture.html](http://localhost:9300/capture.html), you'll add that browser as a worker,
and queen will automatically push the client-side script to the browser to run the test.

## Intended Usage

The examples above are single-user scenarios, and don't do justice
to the scale Queen affords. Queen is intended to act as a browser pool. In real use, you should have one Queen 
server with many browsers connected to it.

You can use the thin-client, [queen-remote](https://github.com/ozanturgut/queen-remote), to execute scripts 
on browsers which are connected to a central queen server. Queen gives each client-side script it's own iframe,
many scripts can run on the same browser simultaneously. If you're using an automatic populator (such as Selenium)
Queen will even recover browsers which crash.

## Commandline Options

### ```-h``` or ```--host [host]```  _[Internal IP Address]:9200 by default_

The host to bind the remote server to. This is the address queen-remote clients will connect to.

### ```-c``` or ```--capture [host]``` _Port 80 for all hostname by default_

The address to bind the capture server to. Browsers will navigate to the url + "/capture.html" to connect to Queen.

### ```--heartbeatInterval <n>``` _20 seconds by default_

Milliseconds clients have to send a heartbeat until they're considered unresponsive.

### ```-v``` or ```--verbose```

Enable debug logging.

### ```-q``` or ```--quiet```

Supress logging.

### ```[path]``` _queenConfig.js by default_

This can either be a local file path, or a URL. The file can either be a Queen config file, or
a server-side Queen script.

If the file is a Queen config file, it will be used to configure this queen instance.

If the file is a Queen server-side script, queen will disable it's remote server and execute 
the server-side script.

## Config File
Queen can be started with a config file by naming the file "queenConfig.js" and executing queen in the
same directory, or by telling Queen the file path to use (example: `queen myConfig.js`). The config file
defines variables, which will be used as the configuration options for queen.

### ```host```

The host to bind the remote server to. This is the address queen-remote clients will connect to.

### ```capture```

The address to bind the capture server to. Browsers will navigate to the url + "/capture.html" to connect to Queen.

### ```script```

A server-side Queen script to run when Queen initializes.

### ```populators```

An array of automatic populators to use.
Queen support auto population from [Selenium Grid](http://seleniumhq.org/), [SauceLabs](https://saucelabs.com/), 
and [BrowserStack](http://www.browserstack.com/). If you're using a cloud service, you need to enable tunneling in order for the browsers 
to connect to Queen.

Here is an example:
```javascript
populators = [
	{
		type: "selenium",
		config: {
			host: '[SELENIUM GRID HOST', 
			port: [SELENIUM GRID PORT]
		},
		clients: [
			{ browserName: "firefox" }
		]
	},
	{
		type: "sauce",
		config: {
			username: "[SAUCE USERNAME]",
			accessKey: "[SAUSE ACCESS KEY]"
		},
		clients: [ // Array of clients to auto populate
			{ 
				browserName: "ipad",
				platform: "Mac 10.8",
				version: "5.1"
			}
		]
	},
	{
		type: "browserstack",
		config: {
			username: "[BROWSER STACK USERNAME]",
			password: "[BROWSER STACK PASSWORD]",
			version: 2 // The api version to use
		},
		clients: [ // Array of clients to auto populate
			{ 
				browser: "firefox",
				version: "11.0",
				os: "win"
			}
		]
	}
];

```

### ```verbose```

Enable debug logging.

### ```quiet```

Supress logging.

### ```heartbeatInterval```

Milliseconds clients have to send a heartbeat until they're considered unresponsive.

## Documentation
* [Technical Overview](https://github.com/ozanturgut/queen/wiki)
* [Client API](https://github.com/ozanturgut/queen/wiki/Client-API)
* [Server API](https://github.com/ozanturgut/queen/wiki/Server-API)
