module.exports = function(text) {
	return ({
		start: function() {
			this.find_all_opening_mustaches();
			return {
				text: text
				, tags: this.tags
			};
		}
		, find_all_opening_mustaches: function() {
			var regex = /{{/g;
			var match;
			this.opening_mustaches = [];
			while(match = regex.exec(text)) {
				if(!this.helpers.is_escaped(match)) {
					this.opening_mustaches.push(match.index);
				}
			}
			this.extract_tags_from_opening_mustaches();
		}
		, extract_tags_from_opening_mustaches: function() {
			var valid_tag_regex = /^{{([^(}})"']*("[^\\"]*(\\.[^\\"]*)*")?('[^\\']*(\\.[^\\']*)*')?)*}}/;
			this.tags = [];
			this.opening_mustaches.forEach (
				function(index) {
					var text_from_index = text.slice(index);
					var match = valid_tag_regex.exec(text_from_index);
					if(!match) {
						throw new Error (
							"Invalid unescaped tag on index " + index + "."
						);
					}
					this.tags.push ({
						string: match[0]
						, index: index
						, end_index: index + match[0].length
					});
				}
				, this
			);
			this.parse_tags();
		}
		, parse_tags: function() {
			this.tags.forEach(this.parse_tag, this);
			this.interpret_tags();
		}
		, parse_tag: function(tag) {
			tag.guts = { string: tag.string.slice(2, -2).trim() };
			this.parse_tag_name(tag);
			this.parse_tag_arguments(tag);
			delete tag.guts;
		}
		, parse_tag_name: function(tag) {
			var regex = /^([#\/]?[a-zA-Z_-][a-zA-Z0-9_-]*)(\s|$)/;
			var match = regex.exec(tag.guts.string);
			var first_character;
			if(!match) {
				throw new Error (
					"Invalid tag name on index " + tag.index + "."
				);
			}
			switch(match[1].charAt(0)) {
				case '#':
					tag.type = 'open-block-tag';
					tag.name = match[1].slice(1);
					break;
				case '/':
					tag.type = 'close-block-tag';
					tag.name = match[1].slice(1);
					break;
				default:
					tag.type = 'simple-tag';
					tag.name = match[1];
					break;
			}
			tag.guts.cursor = match[0].length;
		}
		, parse_tag_arguments: function(tag) {
			if(tag.type === 'close-block-tag') {
				if(tag.guts.cursor < tag.guts.string.length) {
					throw new Error (
						"Invalid close block tag on index " + tag.index + "."
					);
				}
				return;
			}
			tag.arguments = [];
			tag.guts.cursor = this.helpers.skip_whitespace_after (
				tag.guts.string
				, tag.guts.cursor
			);
			while(tag.guts.cursor < tag.guts.string.length) {
				this.parse_tag_argument(tag);
			}
		}
		, parse_tag_argument: function(tag) {
			var guts_from_cursor = tag.guts.string.slice(tag.guts.cursor);
			var identifier_regex = "[a-zA-Z_-][a-zA-Z0-9_-]*";
			var dot_expression_regex = "(" + identifier_regex + "\\.)+" + identifier_regex;
			var number_regex = "[0-9]+(\\.[0-9]+)?";
			var string_regex = "(\"[^\\\\\"]*(\\\\.[^\\\\\"]*)*\"|'[^\\\\']*(\\\\.[^\\\\']*)*')";
			var ws_or_eos = "(\\s|$)";
			var regex = new RegExp (
				"("
					+ "(" + identifier_regex + ws_or_eos + ")"
					+ "|(" + dot_expression_regex + ws_or_eos + ")"
					+ "|(" + number_regex + ws_or_eos + ")"
					+ "|(" + string_regex + ws_or_eos + ")"
				+ ")"
			);
			var match = regex.exec(guts_from_cursor);
			var tag_argument;
			if(!match) {
				throw new Error (
					"Invalid tag argument #" + (tag.arguments.length + 1) + " on index " + tag.index + "."
				);
			}
			tag.arguments.push(match[0].trim());
			tag.guts.cursor += match[0].length;
		}
		, interpret_tags: function() {
			var last_opening_tag = null;
			var interpreted_tags = [];
			this.tags.forEach (
				function(tag) {
					if(!last_opening_tag) {
						switch(tag.type) {
							case 'simple-tag':
								interpreted_tags.push ({
									type: 'simple-tag'
									, name: tag.name
									, arguments: tag.arguments
									, index: tag.index
									, end_index: tag.end_index
								});
								return;
							case 'open-block-tag':
								last_opening_tag = tag;
								return;
							case 'close-block-tag':
								throw new Error (
									"Unmatched closing tag on index " + tag.index + "."
								);
						}
					}
					else
					if(tag.type === 'close-block-tag' && tag.name === last_opening_tag.name) {
						interpreted_tags.push ({
							type: 'block-tag'
							, name: tag.name
							, arguments: last_opening_tag.arguments
							, body: text.slice(last_opening_tag.end_index, tag.index)
							, index: last_opening_tag.index
							, end_index: tag.end_index
						});
						last_opening_tag = null;
					}
				}
			);
			if(last_opening_tag !== null) {
				throw new Error (
					"Unclosed tag on index " + last_opening_tag.index + "."
				);
			}
			this.tags = interpreted_tags;
		}
		, helpers: {
			is_escaped: function(regex_match) {
				var backslashes = 0;
				var cursor = regex_match.index - 1;
				while(cursor >= 0 && text.charAt(cursor) === '\\') {
					++backslashes;
					--cursor;
				}
				return (backslashes !== 0 && backslashes % 2 !== 0);
			}
			, skip_whitespace_after: function(string, index) {
				var cursor = index;
				while (
					cursor < string.length
					&& /[ \t\r\n]/.test(string.charAt(cursor))
				) {
					++cursor;
				}
				return cursor;
			}
		}
	}).start();
};
