var parse = require('./parser');
module.exports = {
	register_helper: function(name, cb) {
		this.helpers[name] = cb;
	}
	, unregister_helper: function(name) {
		delete this.helpers[name];
	}
	, execute: function(template, root, data) {
		var chunks;
		var i;
		root = root || {};
		if(!data) {
			data = Object.create(root);
		}
		else {
			data = Object.create(data);
		}
		data.root = root;
		if(typeof(template) === 'string') {
			template = parse(template);
		}
		chunks = split_on_tags(template).map (
			function(chunk) {
				if(typeof(chunk) === 'string') {
					return chunk;
				}
				else {
					return execute_tag.call(this, data, chunk);
				}
			}
			, this
		);
		return chunks.join('');
	}
	, helpers: {
		if: function(data, args, body) {
			body = parse(body);
			var else_tag_index = body.tags.findIndex (
				function(tag) {
					return (tag.type === 'simple-tag' && tag.name === 'else');
				}
			);
			var else_tag = (else_tag_index === -1)? null : body.tags[else_tag_index];
			if(data[args[0]]) {
				if(!else_tag) {
					return module.exports.execute(body, data, args);
				}
				else {
					return (function() {
						var branch = {
							text: body.text.slice(0, else_tag.index)
							, tags: body.tags.slice(0, else_tag_index)
						};
						return module.exports.execute(branch, data.root, data);
					})();
				}
			}
			else {
				if(else_tag) {
					return (function() {
						var branch = {
							text: body.text.slice(else_tag.end_index)
							, tags: body.tags.slice(else_tag_index + 1)
						};
						return module.exports.execute(branch, data.root, data);
					})();
				}
			}
		}
		, partial: function() {
			return '[partial]';
		}
	}
};
function split_on_tags(template) {
	var text = template.text;
	var tags = template.tags;
	var tag;
	var last_tag = null;
	var slices = [];
	var i;
	if(tags.length === 0) {
		return [text];
	}
	// TODO: Use Array.forEach() here.
	for(i = 0; i < tags.length; ++i) {
		tag = tags[i];
		if(!last_tag || last_tag.end_index < tag.index) {
			slices.push (
				text.slice (
					last_tag? last_tag.end_index : 0
					, tag.index
				)
			);
		}
		slices.push(tag);
		if(i === tags.length - 1 && tag.end_index < text.length) {
			slices.push(text.slice(tag.end_index));
		}
		last_tag = tag;
	}
	return slices;
}
function execute_tag(data, tag) {
	switch(tag.type) {
		case 'simple-tag':
			if(this.helpers[tag.name]) {
				return this.helpers[tag.name](data, tag.arguments);
			}
			else
			if(tag.arguments.length !== 0) {
				throw new Error (
					"Unknown helper '" + tag.name + "'."
				);
			}
			else {
				return (function() {
					var target = data[tag.name];
					switch(typeof(target)) {
						case 'string':
						case 'number':
							return target;
						default:
							return '';
					}
				})();
			}
			break;
		case 'block-tag':
			if(!this.helpers[tag.name]) {
				throw new Error (
					"Unknown helper '" + tag.name + "'."
				);
			}
			return this.helpers[tag.name](data, tag.arguments, tag.body);
		default:
			throw new Error("This is a bug. Please file a bug report.");
	}
}
// ---
if(!Array.prototype.findIndex) {
	Object.defineProperty(Array.prototype, 'findIndex', {
		enumerable: false,
		configurable: true,
		writable: true,
		value: function(predicate) {
			if (this == null) {
				throw new TypeError('Array.prototype.find called on null or undefined');
			}
			if (typeof predicate !== 'function') {
				throw new TypeError('predicate must be a function');
			}
			var list = Object(this);
			var length = list.length >>> 0;
			var thisArg = arguments[1];
			var value;

			for (var i = 0; i < length; i++) {
				if (i in list) {
					value = list[i];
					if (predicate.call(thisArg, value, i, list)) {
						return i;
					}
				}
			}
			return -1;
		}
	});
}
