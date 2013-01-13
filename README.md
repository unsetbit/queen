# Queen [![Build Status](https://secure.travis-ci.org/ozanturgut/queen.png?branch=master)](http://travis-ci.org/ozanturgut/queen)

**Execute scripts on many browsers.**

It's a web server application and application framework which allows for running of scripts on browsers connected to it.
It allows these scripts to have bi-directional communication with whatever requested them to be run.

Browsers run scripts reliably by loading them in an iframes. 
Bi-directional communication is enabled by a global object called "socket" in the iframe namespace. 

Socket.io is used for server-client communication, Queen supports all browsers that Socket.io 
supports (basically, IE5.5 and up).

## Features
* **Target browsers based on user agent or features.** For example,
you could target your script to run only on Firefox browsers, running on Mac, with localstorage capabilities.
* **Run scripts using a Queen server from another machine** using the 
[queen-remote](https://github.com/ozanturgut/queen-remote/) project.
* **Run your scripts continuously as browsers connect to the server** or just once on currently connected browsers.

## A simple example
Lets write a script that writes "ping" in the console of any browser which connects to it.

Here is what the script we want to run on the browsers looks like:
``` javascript
// ping.js
console.log('ping');
socket('pong'); // Emit a message to the server
socket.kill(); // Signal to the server that we're done
```

And this is what our server-side script will look like:
``` javascript
// pingMaker.js
var workforce = queen({
  scripts: ['http://localhost/example/ping.js'], // Path to the file above
	populate: "continuous", // Wait for browsers to connect
	killOnStop: false // Don't exit when there are no browsers connected
});

workforce.on('message', function(message){
  console.log(message); // Output any messages from workers to the console
}
```

Now, we when we execute ```queen --script pingMaker.js``` and queen will start up and listen for connections.
Whenever a browser connects (by going to http://localhost/capture in this case):

1. Queen will push the ping.js script to the browser
2. The browser will emit "ping" in it's console (if it has one).
3. Our application will emit "pong" in it's console.

## Application
Queen can be installed as an application by executing ```npm install -g queen```. Once this is done, 
you can run it with the following options:

* ```-s``` or ```--script```: A queen script to run. This script will have a global [Queen instance](https://github.com/ozanturgut/queen/wiki/Server-API#wiki-queen) called "queen" available to it.
* ```-h``` or ```--host```: The address to bind the remote control server to  (default first external IPv4 address).
* ```-p``` or ```--port```: The port to bind the remote control server to (default 9200).
* ```-v``` or ```--verbose```: Enable debug logging.
* ```-q``` or ```--quiet```: Supress logging.
* ```--capturePort```: The port to bind to for capturing browsers (default 80).
* ```--captureHost```: The address to bind to for capturing browsers (default all).
* ```--noRemote```: Don't start the remote server.

The remote server is automatically disabled when running an individual script.

## Documentation
* [Technical Overview](https://github.com/ozanturgut/queen/wiki)
* [Client API](https://github.com/ozanturgut/queen/wiki/Client-API)
* [Server API](https://github.com/ozanturgut/queen/wiki/Server-API)
