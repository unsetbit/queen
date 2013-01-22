# Queen [![Build Status](https://secure.travis-ci.org/ozanturgut/queen.png?branch=master)](http://travis-ci.org/ozanturgut/queen)

**A platform for running scripts on many browsers.**

Queen is a server which is capable of brokering socketed communication between browsers which are connected to it
and other applications or scripts. You can think of the Queen Server as a pool of browsers which you can 
execute code on. Taking the abstraction further, you can think of Queen Server as distributed execution 
platform using browsers as computation nodes.

In this file:
* [Explanation by Example](#explanation-by-example)
* [Features](#features)
* [Queen Scripts](#queen-scripts)
* [Intended Usage](#intended-usage)
* [Command-line Options](#command-line-options)
* [Interaction Diagram](#interaction-diagram)
* [Technical Documentation](#technical-documentation)

# <a id="explanation-by-example"></a>Explanation by Example
Let's say you want to play a "game" where you write down a number and others try to guess it. 
You gather some friends and tell them to start giving numbers at you. Your friends keep 
giving you random numbers until one of them gets it right.

Now imagine your friends are browsers, and the game is a script which tells browsers how to 
play, and waits for the right number to be guessed. This makes you the Queen Server. The Queen 
Servers allows you to perform distributed tasks on many browsers -- a platform for running 
scripts on many browsers.

Let's run the example:

1. Install [Node.js](http://nodejs.org/) 0.8 or higher.
2. In your terminal, run: `npm install -g queen` (use sudo on mac and linux).
3. Run: `queen -c localhost:9300 http://queenjs.com/server-example.js`
4. [Click here](http://localhost:9300/) and watch your terminal.

Here's what happened:

1. You installed software that allows you to run JavaScript code through the command line (Node).
2. You installed queen using a package manager that comes with Node.
3. You asked queen to start capturing browsers on localhost port 9300 and run this server-side queen script.
4. You pointed your browser to the queen server, allowing queen to push code that the server-side 
5. script requested to run on browsers (the "client-side script"). When this client-side script
6. loaded, it started reporting back to the server-side script random number guesses. Once the
7. server-side script saw the correct number, it ended the process.

## <a id="features"></a>Features
* Bidirectional communication between your client-side and server-side script (using [socket.io](http://socket.io/)).
* Run scripts via command line, configuration file, or import Queen into your own project as a library.
* Target connected browsers based on user-agent or [Modernizr](http://modernizr.com/) capabilities.
* Connect browsers automatically using [Selenium](http://seleniumhq.org/), [BrowserStack](http://www.browserstack.com/), or [SauceLabs](https://saucelabs.com/).
* Run scripts on browsers connected to a central Queen server remotely using a thin-client ([queen-remote](https://github.com/ozanturgut/queen-remote)).
* Automatically detects and recovers unresponsive browsers.
* Can run lists of scripts or an HTML files.

## <a id="queen-scripts"></a>Queen Scripts
You need two scripts to run a job on Queen: a client-side script which will run on browsers, and a server-side script 
which all of the client-side scripts will communicate with. Here's an example of two such scripts:

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
module.exports = function(queen){
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
				queen.log(worker.provider + " is at " + num + "\n");
				
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
};
```

To run this example, run this command in your terminal: `queen -c localhost:9300 http://queenjs.com/ping-server.js`. 
This tells queen to run the server script, and listen for browsers on port 9300. Now if you navigate to
[http://localhost:9300/capture.html](http://localhost:9300/capture.html), you'll add that browser as a worker,
and queen will automatically push the client-side script to the browser to run the test.

## <a id="intended-usage"></a>Intended Usage

The examples above are single-user scenarios, and don't do justice to the scale Queen affords. 
Queen is intended to act as a browser pool. In real use, you should have one Queen server 
with many browsers connected to it, allowing anyone in your network to execute scripts on it
through  [queen-remote](https://github.com/ozanturgut/queen-remote).

Queen gives each client-side script it's own iframe, so, many scripts can run on the same browser 
simultaneously. If you're using an automatic populator (such as Selenium) Queen will automatically restart 
browsers which crash.

## <a id="command-line-options"></a>Command-line Options
Queen can be executed through the command line as `queen [options] [filepath]`.
The only thing you cannot configure through the command line is populators, you'll need a 
[Queen config file](https://github.com/ozanturgut/queen/wiki/Queen-Config-File) to define those.

### ```[path]``` _queenConfig.js by default_

This can either be a local file path, or a URL. The file can either be a Queen config file, or
a server-side Queen script.

If the file is a [Queen config file](https://github.com/ozanturgut/queen/wiki/Queen-Config-File), it will be used to configure this queen instance.

If the file is a Queen server-side script, queen will disable it's remote server and execute 
the server-side script.

### ```-h``` or ```--host [host]```  _port 9200 on all hosts by default_

The host to bind the remote server to. This is the address queen-remote clients will connect to.

### ```-c``` or ```--capture [host]``` _[Internal IP Address]:80 by default_

The address to bind the capture server to. Browsers will navigate to the url + "/capture.html" to connect to Queen.

### ```--heartbeatInterval <n>``` _60 seconds by default_

Milliseconds clients have to send a heartbeat until they're considered unresponsive.

### ```-v``` or ```--verbose```

Enable debug logging.

### ```-q``` or ```--quiet```

Supress logging.


## <a id="diagram"></a>Interaction Diagram
![Queen Diagram](http://queenjs.com/r/Queen%20Diagram.png)

## <a id="technical-documentation"></a>Technical Documentation
* [Technical Overview](https://github.com/ozanturgut/queen/wiki)
* [Client API](https://github.com/ozanturgut/queen/wiki/Client-API)
* [Server API](https://github.com/ozanturgut/queen/wiki/Server-API)
