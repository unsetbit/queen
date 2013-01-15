var tty = require('tty'),
	path = require('path'),
	vm = require('vm'),
	fs = require('fs');

var utils = require('./utils.js'),
	createQueen = require('./queen.js'),
	createQueenRemoteServer = require("queen-remote").server;

var runner = module.exports = function(config, callback){
	if(!config) throw new Error('Config must be defined');
	callback = callback || utils.noop;

	// A queen.js file may pass in a default "base" queen.js file to use for default values
	// This only goes one level down, if the defaults file defines a defaults file, it won't be
	// evaluated.
	if(config.config){
		config.file = config.config;
	}

	var baseConfig = {};
	if(config.file){
		baseConfig = fileHandler(config);
		if(!baseConfig) return callback({passed: false});
	}

	var defaults = require('../../config/runner.json');

	// This fills any default properties to the config object (if they're not defined)
	setDefaults(setDefaults(config, baseConfig), defaults);

	// Collapse the config options and default options in to one variable
	var log = config.quiet? utils.noop : process.stdout.write.bind(process.stdout),
		debug = config.verbose? process.stdout.write.bind(process.stdout) : utils.noop;

	function onQueenReady(queen, err){
		if(!queen){
			log(err);
			return callback(false);
		}

		process.on('exit', queen.kill); // Won't work on Windows
		
		// Attach populators
		config.populators.forEach(function(populatorConfig){
			var createPopulator, 
				populator,
				populatorType = populatorConfig.type;

			switch(populatorType){
				case "selenium":
					createPopulator = require('./populator/selenium.js');
					populator = createPopulator(populatorConfig.config);
					break;
				case "sauce":
					createPopulator = require('./populator/sauce.js');
					populator = createPopulator(populatorConfig.config.username, populatorConfig.config.accessKey, populatorConfig.config);
					break;
				case "browserstack":
					createPopulator = require('./populator/browserstack.js');
					populator = createPopulator(populatorConfig.config);
					break;
				default:
					log('Unknown populator type: ' + populatorType);
					return;
			}

			populator.clients = populatorConfig.clients || [];
			log('Attaching populator: ' + populatorType);
			queen.attachPopulator(populator);
		});

		if(config.script){
			try {
				global.queen = queen;
				global.require = require;
				var context = vm.createContext(global);
				vm.runInContext(fs.readFileSync(script), context);
			} catch(e) {
				if (e.name === 'SyntaxError') {
				  log('Syntax error in script file!\n' + e.message);
				} else if (e.code === 'ENOENT' || e.code === 'EISDIR') {
				  log('Script file does not exist!');
				} else {
				  log('Invalid file!\n', e);
				}

				callback();
			}
		} else {
			var remoteServer = createQueenRemoteServer(queen, {
				port: config.port,
				host: config.host || getExternalIpAddress(),
				log: log,
				debug: debug
			});

			callback(queen);
		}
	}

	createQueen({
		callback: onQueenReady,
		port: config.httpPort,
		host: config.httpHost,
		heartbeatInterval: config.heartbeatInterval,
		log: log,
		debug: debug
	});
};


var startQueen = function(app){
	var config = {};

	var createQueenRemoteServer = require('queen-remote').server,
		createQueen = require('../'),
		captureHost = app.captureHost || config.captureHost,
		capturePort = app.capturePort || config.capturePort,
		port = app.port || config.port,
		host = app.host || config.host,
		heartbeatInterval = app.heartbeatInterval || config.heartbeatInterval,
		populatorConfigs = config.populators || [],
		populators = [],
		quiet = app.quiet !== false || config.quiet !== false,
		verbose = app.verbose === true || config.verbose === true,
		script = app.script || config.script,
		noRemote = app.noRemote === true || config.noRemote === true,
		log = quiet ? console.log.bind(console) : void 0,
		debug = verbose? console.log.bind(console) : void 0;
	
	createQueen({
		callback: onQueenReady,
		port: capturePort,
		host: captureHost,
		heartbeatInterval: heartbeatInterval,
		log: log,
		debug: debug
	});



	function onQueenReady(queen){
		process.on('exit', queen.kill); // Won't work on Windows - booooo
		
		populators.forEach(function(populator){
			queen.attachPopulator(populator);
		});

		// If a script was defined, execute it with queen as a global variable
		if(script){
			try {
				global.queen = queen;
				global.require = require;
				var context = vm.createContext(global);
				vm.runInContext(fs.readFileSync(script), context);
			} catch(e) {
				if (e.name === 'SyntaxError') {
				  console.error('Syntax error in script file!\n' + e.message);
				} else if (e.code === 'ENOENT' || e.code === 'EISDIR') {
				  console.error('Script file does not exist!');
				} else {
				  console.error('Invalid file!\n', e);
				}

				process.exit(1);
			}
		} 

		if(!noRemote) {
			var remoteServer = createQueenRemoteServer(queen, {
				port: port,
				host: host || getExternalIpAddress(),
				log: log,
				debug: debug
			});
		}
	}
};

// If we have a file it's either a config file, an html file or a test file.
// First we check to see if it's a config file by trying to parse the file
// within a JS VM. If there's a syntax error, it may be an HTML file,
// if there's a general error, it may be a test file.
function fileHandler(config){
	var baseConfig = {},
		baseDir;

	try {
		vm.runInNewContext(fs.readFileSync(config.file), baseConfig);
		config.config = path.resolve(config.file);
		baseDir = path.dirname(config.config);
		// Resolve any filepaths in the config object relative to the config file
		if(Array.isArray(baseConfig.run)){
			baseConfig.run = baseConfig.run.map(function(filePath){
				return path.resolve(baseDir, filePath);
			});
		}

		if(baseConfig.serve && typeof baseConfig.serve !== "string"){
			baseConfig.serve = utils.map(baseConfig.serve, function(filePath, key){
				return path.resolve(baseDir, filePath);
			});
		}
	}  catch(e) {
		if (e.name === 'SyntaxError') {
			// If a signle file is passed in and it has invalid JS syntax,
			// we're going to assume that this is an HTML file to test
			if(!config.run) config.run = path.resolve(config.file);
			else {
				console.error('Syntax error in file!\n' + e.message);
				return false;
			}
		} else if (e.code === 'ENOENT' || e.code === 'EISDIR') {
			console.error('Config file does not exist!');
			return false;
		} else {
			// If a single file is passed in and it has valid JS syntax,
			// it'll likely throw an error when it's evaluated by the vm
			// because it doesn't have the right context, so we'll assume
			// the user has passed us a script file to test
			if(!config.run) config.run = [path.resolve(config.file)];
			else {
				console.error('Error in parsing file: ' + e);
				return false;
			}
		}
	}

	return baseConfig;
}

// Returns an IP address for this machine. Modified from: http://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
function getExternalIpAddress(){
	var interfaces = require('os').networkInterfaces(),
		addresses = [];

	utils.each(interfaces, function(interf, name){
		addresses = addresses.concat(
			utils.filter(interf, function(node){
				return node.family === "IPv4" && node.internal === false;
			})
		);
	});

	if(addresses.length > 0){
		return addresses[0].address;
	}
}

// Fills in obj with defaults' variables if obj doesn't already define it.
function setDefaults(obj, defaults){
	var variable;
	utils.each(defaults, function(value, key){
		if(obj[key] === void 0) obj[key] = value;
	});
	
	return obj;
}
