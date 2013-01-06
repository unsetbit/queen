exports.noop = function(){};

// by Artem Barger from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
exports.getParameterByName = function(name){
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if(results == null)	return "";
	else return decodeURIComponent(results[1].replace(/\+/g, " "));
}