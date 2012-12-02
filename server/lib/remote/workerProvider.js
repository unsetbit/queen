var create = function(id, attributes){
	var self = {
		id: id,
		attributes: Object.freeze(attributes)
	}

	return getApi.call(self);
};

var getApi = function(){
	var api;

	api.id = id;
	api.attributes = attributes;

	return api;
};