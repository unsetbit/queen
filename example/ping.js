queen({
	scripts: ['http://localhost/example/ping.js'],
	populate: "continuous",
	killOnStop: false,
	timeout:1000,
	workforceTimeout:10
});
