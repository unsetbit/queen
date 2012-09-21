define(function(require, exports, module) {
	/**
	 * Inherit the prototype methods from one constructor into another.
	 *
	 * Usage:
	 * <pre>
	 * function ParentClass(a, b) { }
	 * ParentClass.prototype.foo = function(a) { }
	 *
	 * function ChildClass(a, b, c) {
	 *   goog.base(this, a, b);
	 * }
	 * goog.inherits(ChildClass, ParentClass);
	 *
	 * var child = new ChildClass('a', 'b', 'see');
	 * child.foo(); // works
	 * </pre>
	 *
	 * In addition, a superclass' implementation of a method can be invoked
	 * as follows:
	 *
	 * <pre>
	 * ChildClass.prototype.foo = function(a) {
	 *   ChildClass.superClass_.foo.call(this, a);
	 *   // other code
	 * };
	 * </pre>
	 *
	 * @param {Function} childCtor Child class.
	 * @param {Function} parentCtor Parent class.
	 */
	exports.inherits = inherits = function(childCtor, parentCtor) {
	  /** @constructor */
	  function tempCtor() {};
	  tempCtor.prototype = parentCtor.prototype;
	  childCtor.superClass_ = parentCtor.prototype;
	  childCtor.prototype = new tempCtor();
	  /** @override */
	  childCtor.prototype.constructor = childCtor;
	};


	exports.extend = extend = function(){
		var options, name, copy,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length;

		for ( ; i < length; i++ ) {
			// Only deal with non-null/undefined values
			options = arguments[i];
			if ( options  !== null && options !== void(0)) {
				// Extend the base object
				for ( name in options ) {
					copy = options[name];
		
					if ( copy !== void(0)  && target !== copy ) {
						target[name] = copy;
					}
				}
			}
		}
		
		// Return the modified object
		return target;
	};

	exports.create = create = function(parentFunc, childFunc, prototype){
		inherits(childFunc, parentFunc);
		extend(childFunc.prototype, prototype);
		return childFunc;
	};


	exports.isSimilar = isSimilar = function(subObject, superObject){
		return _.all(subObject, function(value, key){
			if(_.isObject(value) || _.isArray(value)){
				return isSimilar(value, superObject[key]);
			}

			return superObject[key] === value;
		});
	};

  return exports;
});