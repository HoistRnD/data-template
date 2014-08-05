var Template = (function () {
	var toString = Object.prototype.toString;

	function classOf(data) {
		return toString.call(data).slice(8, -1);
	}

	function escape(s) {
		return s.replace(/-/g, "-=");
	}
	
	function unescape(s) {
		return s.replace(/-=/g, "-");
	}
	
	function vivify(html, doc, parentName) {
		// need to make an element with the same nodeName as the
		// prospective parent, else e.g. <tr> elements will be
		// stripped by the browser, as they don't fit inside <div>
	
		var div = (doc || document).createElement(parentName || "div");
		div.innerHTML = html;
		return div.firstChild;
	}
	
	var strs = {
		beginMagic: "Hoist.Templates.BeginConstruct",
		endMagic: "Hoist.Templates.EndConstruct",
		iterateOver: "data-each",
		setAttributePrefix: "data-set-",
		hasSetter: "data-set",
		template: "data-text",
		htmlTemplate: "data-html",
		hasConstruct: "data-has-construct",
		
		constructs: {
			"data-each": "expandEach",
			"data-if-empty": "expandIfEmpty",
			"data-if-nonempty": "expandIfNonEmpty",
			"data-if": "expandIf",
			"data-unless": "expandIfNot",
			"data-with": "expandWith",
			"data-with-nonempty": "expandWithNonEmpty",
			"data-with-always": "expandWithAlways"
		}
	};
	
	return {
	
		fn: {},
	
		init: function () {
			var scope = document, node = scope, val;
			
			// traverse in reverse document order
			
			while (node.lastChild) node = node.lastChild;
			
			while (node != scope) {
				// visit node
				
				if (node.nodeType == 1) {
					var hasSetter = false, putSetters = [];
				
					for (var i = 0; i < node.attributes.length; i++) {
						var attr = node.attributes[i];

						if (attr.name == strs.template || attr.name == strs.htmlTemplate || attr.name.slice(0, strs.setAttributePrefix.length) == strs.setAttributePrefix) {
							hasSetter = true;
						} else {
							// set the setter automagically if you figure out it's a template
						
							if (attr.value.indexOf('[') > -1 && !strs.constructs[attr.name]) {
								putSetters.push(attr);
							}
						}
					}
					
					if (putSetters.length || hasSetter) node.setAttribute(strs.hasSetter, "");
					
					for (var i = 0; i < putSetters.length; i++) {
						node.setAttribute(strs.setAttributePrefix + putSetters[i].name, putSetters[i].value);
						node.removeAttribute(putSetters[i].name);
					}
				
					for (var attr in strs.constructs) {
						if (node.hasAttribute(attr)) {
							val = node.getAttribute(attr);
							node.removeAttribute(attr);

							var parent = node.parentNode, html = node.outerHTML;
							var comment = node.ownerDocument.createComment(strs.beginMagic + attr + " " + val + " " + escape(html));
					
							parent.insertBefore(comment, node);
							parent.insertBefore(node.ownerDocument.createComment(strs.endMagic), node);
							parent.removeChild(node);
					
							parent.setAttribute(strs.hasConstruct, "");
					
							node = comment;
							break;
						}
					}
				}
				
				else if (node.nodeType == 3) {
					// set the setter automagically if you figure out it's a template
				
					if (node.nodeValue.indexOf('[') > -1 && node.parentNode.nodeType == 1) {
						node.parentNode.setAttribute(strs.template, node.nodeValue);
						
						// this is a bit gnarly: don't need the text node anymore

						node = node.parentNode;
						while (node.lastChild) node.removeChild(node.lastChild);
						continue;
					}
				}
				
				if (node.previousSibling) {
					node = node.previousSibling;
					while (node.lastChild) node = node.lastChild;
				} else {
					node = node.parentNode;
				}
			}
		},
		
		get: function (key, nothing) {
			// read initial dots to move back in the stack

			var model, context;
			
			if (key[0] === "`") {
				key = key.slice(1);
				
				model = this.stack[0];
				context = this.contexts[0];
			} else {
				for (var i = 0; i < key.length - 1 && key[i] === "."; i++);
				if (i) key = key.slice(i);

				model = this.stack[this.stack.length - i - 1];
				context = this.contexts[this.contexts.length - i - 1];
			}
		
			if (!key || key == ".") {
				if (model == null) return nothing;
				return model;
			}
	
			if (key.indexOf(".") == -1 && key.indexOf("[") == -1 && key.indexOf("(") == -1) {
				if (context && (key in context)) return context[key];	
				if (!model) return nothing;
				
				if (!model[key] && model.get) model = model.get(key);
				else model = model[key];
			
				if (model == null) return nothing;
				
				return model;
			}
		
		    if (model == null) return nothing;
		    
		    // handle recursion and function application. i'm shocked that this works.
		
		    var at = model, indexed, expr = key, applying, fn, args;
		    
		    for (var i = 0, start = 0, depth = 0; i <= expr.length; i++) {
		    	var c = expr[i];
		    	
		    	if (c == '.') {
		    		if (depth) continue;
		    	} else if (c == '(') {
		    		depth++;
		    		if (depth > 1) continue;
		    		else applying = 1;
		    	} else if (c == ',') {
		    		if (depth > 1) continue;
		    		else applying = 2;
		    	} else if (c == ')') {
		    		depth--;
		    		if (depth) continue;
		    		else applying = 3;
		    	} else if (c == ']') {
		    		depth--;
		    		if (depth) continue;
		    		else indexed = true;
		    	} else if (c == '[') {
		    		depth++;
		    		if (depth > 1) continue;
		    	} else if (c) continue;
		    	
		    	var key;
		    	
				if (applying) {
					if (applying == 1) {
						fn = this.fn[expr.slice(start, i)];
						args = [];
					} else if (applying == 2) {
						args.push(this.get(expr.slice(start, i)));
					} else if (applying == 3) {
						if (i > start) {
							args.push(this.get(expr.slice(start, i)));
						}
						
						at = fn && fn.apply(at, args);
						
						if (at == null) return nothing;
						
						applying = null;
					}
				} else if (i > start) {
					if (indexed) {
						key = this.get(expr.slice(start, i), null);
						if (key == null) return nothing;
						indexed = false;
					} else {
						key = expr.slice(start, i);
					}

					if (!at[key] && at.get) at = at.get(key);
					else at = at[key];
			
					if (at == null) return nothing;
				}
		    	
		    	start = i + 1;
		    }

    		return at;
		},
		
		test: function (guard) {
			var colon = guard.lastIndexOf(':');
			
			if (colon > -1) {
				if (guard[colon + 1] == ':') {
					return classOf(this.get(guard.slice(0, colon))) == guard.slice(colon + 2);
				} else {
					return this.get(guard.slice(0, colon)) == guard.slice(colon + 1);
				}
			} else {
				return this.get(guard);
			}
		},
		
		renderInternal: function (el, sub) {
			if (el.jquery) el = el[0];
			var node = el, attrs, doc = node.ownerDocument;
		
			while (node) {
				// visit on the way down
				
				if (node.nodeType == 1) {
				
					if (node.hasAttribute(strs.hasSetter)) {
					
						attrs = {};
				
						for (var i = 0; i < node.attributes.length; i++) {
							var attr = node.attributes[i].name;

							if (attr == strs.template) {
								while (node.lastChild) node.removeChild(node.lastChild);
						
								node.appendChild(doc.createTextNode(Template.replace(node.attributes[i].value)));
							}
							else if (attr == strs.htmlTemplate) {
								node.innerHTML = Template.replace(node.attributes[i].value);
							}
							else if (attr.slice(0, strs.setAttributePrefix.length) == strs.setAttributePrefix) {
								attrs[attr.slice(strs.setAttributePrefix.length)] = Template.replace(node.attributes[i].value);
							}
						}
				
						for (var x in attrs) {
							node.setAttribute(x, attrs[x]);
						}
					}
				
					if (node.hasAttribute(strs.hasConstruct)) {
						this.contract(node);
					}
				}
				
				// move down first, then across
				
				if (node.firstChild) {
					node = node.firstChild;
				} else {
					while (true) {
						// visit on the way up
					
						if (node.nodeType == 1 && node.hasAttribute(strs.hasConstruct)) {
							this.expand(node, sub);
						}						
					
						if (node == el || node.nextSibling) break;
						else node = node.parentNode;
					}
					
					if (node == el) break;
					else node = node.nextSibling;
				}
			}
			
			return el;
		},
		
		stack: [],
		
		contexts: [],
	
		render: function (el, model, sub) {
			if (!el) return el;
		
			this.stack.push(model);
			
			this.renderInternal(el, sub);
			
			this.stack.pop();
			
			return el;
		},
		
		replace: function (template) {
			var self = this;
		
			if (template.indexOf('[') == -1) return template;
			
			var res = [];
			
			for (var i = 0, start = 0, depth = 0; i <= template.length; i++) {
				var c = template[i];
			
				if (c == '[' || !c) {
					if (!depth) {
						res.push(template.slice(start, i));
						start = i + 1;
					}
					
					depth++;
				}
				
				else if (c == ']') {
					depth--;

					if (!depth) {
						res.push(this.get(template.slice(start, i), ""));
						start = i + 1;
					}
				}
			}
			
			return res.join('');
		},
		
		expandEach: function (html, node, field) {
			var guard = field.indexOf('|'),
				model;
				
			if (guard > -1) {
				model = this.get(field.slice(0, guard));
				guard = field.slice(guard + 1);
			} else {
				model = this.get(field);
				guard = null;
			}
		
			if (!model) return;
				
			var context = { "@": model };
			
			if (model.models) model = model.models;
			if (!model.length) return;
			
			var doc = node.ownerDocument,
				frag = doc.createDocumentFragment(),
				parentName = node.parentNode.nodeName;
			
			this.contexts.push(context);
			
			for (var i = 0; i < model.length; i++) {
				context["#"] = i;
				
				this.stack.push(model[i]);
				
				if (!guard || this.test(guard)) {
					frag.appendChild(this.renderInternal(vivify(html, doc, parentName), true));
				}
				
				this.stack.pop();
			}
			
			this.contexts.pop();
			
			node.parentNode.insertBefore(frag, node);
		},
		
		expandIfEmpty: function (html, node, field) {
			var model = this.get(field);		

			if (model && (model.models || model.length) && (!model.models || model.models.length)) return;
			
			node.parentNode.insertBefore(this.renderInternal(vivify(html, node.ownerDocument, node.parentNode.nodeName), true), node);
		},
		
		expandIfNonEmpty: function (html, node, field) {
			var model = this.get(field);

			if (!model) return;
			if (model.models) model = model.models;
			if (!model.length) return;
		
			node.parentNode.insertBefore(this.renderInternal(vivify(html, node.ownerDocument, node.parentNode.nodeName), true), node);
		},
		
		expandWithNonEmpty: function (html, node, field) {
			var model = this.get(field);

			if (!model) return;
			if (model.models) model = model.models;
			if (!model.length) return;
		
			node.parentNode.insertBefore(this.render(vivify(html, node.ownerDocument, node.parentNode.nodeName), model, true), node);
		},
		
		expandWith: function (html, node, field) {
			model = this.get(field);
			if (!model) return;
			
			node.parentNode.insertBefore(this.render(vivify(html, node.ownerDocument, node.parentNode.nodeName), model, true), node);
		},
		
		expandWithAlways: function (html, node, field) {
			model = this.get(field);
			
			node.parentNode.insertBefore(this.render(vivify(html, node.ownerDocument, node.parentNode.nodeName), model, true), node);
		},
		
		expandIf: function (html, node, field) {
			if (!this.test(field)) return;
			node.parentNode.insertBefore(this.renderInternal(vivify(html, node.ownerDocument, node.parentNode.nodeName), true), node);
		},
		
		expandIfNot: function (html, node, field) {
			if (this.test(field)) return;
			node.parentNode.insertBefore(this.renderInternal(vivify(html, node.ownerDocument, node.parentNode.nodeName), true), node);
		},
		
		contract: function (el) {
			if (el.jquery) el = el[0];
			
			for (var node = el.firstChild; node; node = node.nextSibling) {
				if (node.nodeType != 8) continue;
				
				if (node.nodeValue.slice(0, strs.beginMagic.length) != strs.beginMagic) continue;
					
				while(node.nextSibling.nodeType != 8 || node.nextSibling.nodeValue != strs.endMagic) {
					el.removeChild(node.nextSibling);
				}
			}
		},
		
		expand: function (el, sub) {
			if (el.jquery) el = el[0];
			
			var node = el.firstChild, next;
			
			while (node) {
				if (node.nodeType == 8) {				
					var content = node.nodeValue;
					
					if (content.slice(0, strs.beginMagic.length) == strs.beginMagic) {
						var space1 = content.indexOf(' ', strs.beginMagic.length),
							space2 = content.indexOf(' ', space1 + 1),
							attr = content.slice(strs.beginMagic.length, space1),
							field = content.slice(space1 + 1, space2);
					
						content = unescape(content.slice(space2 + 1));
					
						this[strs.constructs[attr]](content, next = node.nextSibling, field);
						
						if (sub) el.removeChild(node);
						node = next;
					}
				
					next = node.nextSibling;
					
					if (sub) el.removeChild(node);
					node = next;
				} else {
					node = node.nextSibling;
				}
			}
		}
	};
})();