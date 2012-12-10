**Queen is distributed execution of scripts on browsers.**

It's a web server which runs scripts on browsers connected to it.
It allows these scripts to have bi-directional communication with whatever requested them to be run.

Browsers run scripts reliably by loading them in an iframes. 
Bi-directional communication is enabled by a global object called "socket" in the iframe namespace. 

Socket.io is used for server-client communication, Queen supports all browsers that Socket.io 
supports (basically, IE5.5 and up).

## Features
* **Run your scripts continuously as browsers connect to the server** or just once on currently connected browsers.
* **Target browsers based on user agent or features.** For example,
you could target your script to run only on Firefox browsers, running on Mac, with localstorage capabilities.
* **Run scripts using a Queen server from another machine** using the 
[queen-remote](https://github.com/ozanturgut/queen-remote/) project.

## A simple example
Lets say I'm running a simple Queen server on localhost with a script like this at the end:
``` javascript
// server.js
// code initializing Queen omitted
queen({
  scripts: ['http://localhost/ping.js'],
  populate: "continuous",
  killOnStop: false
});
```

And here is what ping.js looks like
``` javascript
console.log('ping');
socket.kill();
```

Now, whenever a browser navigates to http://localhost/capture, it will output "ping" in its console 
(if console logging is supported).

## Documentation
* [Technical Overview](https://github.com/ozanturgut/queen/wiki)
* [Client API](https://github.com/ozanturgut/queen/wiki/Client-API)
* [Server API](https://github.com/ozanturgut/queen/wiki/Server-API)