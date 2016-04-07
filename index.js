/* The GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (AGPL-3.0)

rule-reactor: A light weight, fast, expressive forward chaining business rule engine leveraging JavaScript internals and Functions as objects rather than Rete.

Copyright (c) 2016 Simon Y. Blackwell

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var uuid = require("uuid");
(function() {
	"use strict";

	function intersection(array) {
		var arrays = arguments.length;
		// fast path when we have nothing to intersect
		if (arrays === 0) {
			return [];
		}
		if (arrays === 1) {
			return intersection(array,array);
		}
		 
		var arg   = 0, // current arg index
				bits  = 0, // bits to compare at the end
				count = 0, // unique item count
				items = [], // unique items
				match = [], // item bits
				seen  = new Map(); // item -> index map
		 
		do {
			var arr = arguments[arg],
					len = arr.length,
					bit = 1 << arg, // each array is assigned a bit
					i   = 0;
		 
			if (!len) {
				return []; // bail out if empty array
			}
		 
			bits |= bit; // add the bit to the collected bits
			do {
				var value = arr[i],
						index = seen.get(value); // find existing item index
		 
				if (index === undefined) { // new item
					count++;
					index = match.length;
					seen.set(value, index);
					items[index] = (value ? value.valueOf() : value)
				} else { // update existing item
					match[index] |= bit;
				}
			} while (++i < len);
		} while (++arg < arrays);
		 
			var result = [],
			i = 0;
		 
		do { // filter out items that don't have the full bitfield
			if (match[i] === bits) {
				result[result.length] = items[i];
			}
		} while (++i < count);
		 
			return result;
	}
	
//	portions from http://phrogz.net/lazy-cartesian-product
	function CXProduct(collections){
		this.deleted = {};
		this.collections = (collections ? collections : []);
		Object.defineProperty(this,"length",{set:function() {},get:function() { var size = 1; this.collections.forEach(function(collection) { size *= collection.length; }); return size; }});
		Object.defineProperty(this,"size",{set:function() {},get:function() { return this.length; }});
	}
	CXProduct.prototype.add = function(collections) {
		var me = this;
		if(!me.fixed) {
			collections.forEach(function(collection) {
				me.collections.push(collection);
			});
		} // should throw if fixed
		return me;
	}
	function testpattern(pattern,row) {
		return pattern.length===row.length && row.every(function(element,i) {
			return pattern[i]===undefined || pattern[i]===element || (typeof(pattern[i])==="function" && pattern[i].call(row,row[i],i));
		});
	}
	CXProduct.prototype.every = function(callback,pattern,test) {
		var me = this, i = 0;
		do {
			if(!me.deleted[i]) {
				var value = me.get(i);
				if(value!==undefined) {
					if((!test || test(value)) && (!pattern || testpattern(pattern,value)) && !callback(value)) {
						return false;
					};
				}
			}
			i++;
		} while(value!==undefined); 
		return true;
	}
	function get(n,collections,dm,c) {
		for (var i=collections.length;i--;)c[i]=collections[i][(n/dm[i][0]<<0)%dm[i][1]];
	}
	CXProduct.prototype.get = function(index,pattern){
		var me = this, c = [];
		for (var dm=[],f=1,l,i=me.collections.length;i--;f*=l){ dm[i]=[f,l=me.collections[i].length];  }
		if(index>=me.length) {
			return undefined;
		}
		get(index,me.collections,dm,c);
		if(!pattern || pattern.every(function(value,i) {
			return value===undefined || (typeof(value)==="function" ? value.call(c,c[i],i) : false) || c[i]===value;
		})) {
			return c.slice(0);
		}
	}
	CXProduct.prototype.indexOf = function(row) {
		var me = this, index = 0;
		for (var dm=[],f=1,l,i=me.collections.length;i--;f*=l){ dm[i]=f,l=me.collections[i].length; }
		if(me.collections.every(function(collection,i) {
			var pos = collection.indexOf(row[i]);
			if(pos>=0) {
				index += (pos * dm[i]);
				return false;
			}
			return false;
		})) {
			return index;
		}
		return -1;
	}
	CXProduct.prototype.intersection = function(cxproduct) {
		var me = this, collections = [];
		if(me.collections.length!==cxproduct.collections.length) {
			return new CXProduct([]);
		}
		me.collections.forEach(function(collection,i) {
			collections.push(intersection(collection,cxproduct.collections[i]));
		});
		return new CXProduct(collections);
	}
	CXProduct.prototype.push = function(collectionIndex,element) {
		if(!me.fixed) {
			this.collections[collectionIndex].push(element);
		} // if fixed should throw
		return this;
	}
	CXProduct.prototype.some = function(callback,pattern,test) {
		var me = this, i = 0;
		do {
			if(!me.deleted[i]) {
				var value = me.get(i);
				if(value!==undefined) {
					if((!test || test(value)) && (!pattern || testpattern(pattern,value)) && callback(value)) {
						return true;
					};
				}
			}
			i++;
		} while(value!==undefined); 
		return false;
	}
	CXProduct.prototype.verify = function(i,row) {
		var me = this;
		var match = me.get(i);
		return match && match.every(function(element,i) { return element===row[i]; });
	}
	function dive(d,counter,collections,lens,p,callback,pattern,test){
		var a=collections[d], max=collections.length-1,len=lens[d];
		if (d==max) {
			for (var i=0;i<len;++i) { 
				p[d]=a[i]; 
				if(!test || test(p)) {
					callback(p.slice(0),counter.count); 
				}
				counter.count++;
			}
		} else {
			for (var i=0;i<len;++i) {
				p[d]=a[i]; 
				dive(d+1,counter,collections,lens,p,callback,pattern,test);
			}
		}
		p.pop();
	}
	CXProduct.prototype.forEach1 = function(callback,pattern,test) {
		var me = this, p=[],lens=[];
		for (var i=me.collections.length;i--;) lens[i]=me.collections[i].length;
		dive(0,{count:0},me.collections,lens,p,callback,pattern,test);
	}
	CXProduct.prototype.forEach2 = function(callback,pattern,test) {
		var me = this, i = 0;
		do {
			if(!me.deleted[i]) {
				var value = me.get(i);
				if(value!==undefined) {
					callback(value);
				}
			}
			i++;
		} while(value!==undefined);
	}
	CXProduct.prototype.forEach = CXProduct.prototype.forEach1;
	
	function getFunctionArgs(f) {
		var str = f+"";
		var start = str.indexOf("(")+1;
		var end = str.indexOf(")");
		var result = str.substring(start,end).split(",");
		result.forEach(function(arg,i) {
			result[i] = arg.trim();
		});
		if(result.length===1 && result[0]==="") {
			return [];
		}
		return result;
	}
	function definePropertyGenerator(ruleReactor,constructor,key) {
		var propertyGenerator = function(value) {
			var get = function() {
				return get.value;
			};
			get.value = value;
			var set = function(value) {
				var instance = this;
				if(instance.__rrid__ && get.value!==value) {
					if(me.tracelevel>2) {
						Console.log("Modify: ",instance,key,get.value,"=>",value);
					}
					var oldvalue = get.value;
					// set new value
					get.value = value;
					updateIndex(this.constructor.index,instance,key,oldvalue);
					ruleReactor.dataModified = true;
					// if the value is an object that has possible rule matches, assert it
					if(value && value.rules) {
						ruleReactor.assert(value);
					}
					// re-test the rules that pattern match the key
					Object.keys(instance.rules).forEach(function(rulename) {
						var rule = instance.rules[rulename];
						if(Object.keys(rule.range).some(function(variable) {
							return rule.range[variable][key] && instance instanceof rule.domain[variable];
						})) {
							var activations = rule.activations.get(instance);
							if(activations) {
								activations.forEach(function(activation) {
									activation.delete();
								});
							}
							rule.test(instance,key);
						}
					});
				}
			}
			Object.defineProperty(this,key,{enumerable:true,configurable:true,get:get,set:set});
			return get.value;
		}
		Object.defineProperty(constructor.prototype,key,{enumerable:true,configurable:true,get:propertyGenerator,set:propertyGenerator});
	}
	function compile(rule) {
		var me = this, variables = Object.keys(rule.domain);
		variables.forEach(function(variable) {
			var cons = rule.domain[variable];
			if(typeof(cons)!=="function") {
				throw new TypeError("Domain variable " + variable + " is not a constructor in rule " + rule.name);
			}
			cons.instances = (cons.instances ? cons.instances : []);
			cons.index = (cons.index ? cons.index : {});
			cons.prototype.rules = (cons.prototype.rules ? cons.prototype.rules : {});
			cons.prototype.rules[rule.name] = rule;
			cons.prototype.activeKeys = (cons.prototype.activeKeys ? cons.prototype.activeKeys : {});
			cons.exists = function(f) {
				f = (f ? f : function() { return true; });
				return cons.instances && cons.instances.some(function(instance) {
					return f(instance);
				});
			};
			cons.forall = function(f) {
				return cons.instances && cons.instances.every(function(instance) {
					return f(instance);
				});
			};
			rule.range[variable] = {};
			rule.bindings[variable] = (rule.bindings[variable] ? rule.bindings[variable] : []);
			// extract instance keys from condition using a side-effect of replace
			rule.conditions.forEach(function(condition,cnum) {
				(condition+"").replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
					function(match) { 
						var parts = match.split("."),key = parts[1];
						// cache reactive non-function keys on class prototype
						if(key.indexOf("(")===-1) {
							cons.prototype.activeKeys[key] = true;
							// cache what keys are associated with what variables
							rule.range[variable][key] = true;
						}
						// don't really do a replacement!
						return match;
					}
				);
			})
		});
		rule.triggers.push({domain:rule.domain,range:rule.range});
		rule.conditions.forEach(function(condition,cnum) {
			(condition+"").replace(/exists\(\s*({.*}),(.*)\)/g,
				function(match,domainstr,conditionstr) {
					var domain = new Function("return " + domainstr)(), variables = Object.keys(domain);
					var quantification = {domain: domain, range: {}};
					rule.triggers.push(quantification);
					variables.forEach(function(variable) {
						var cons = domain[variable];
						quantification.range[variable] = (quantification.range[variable] ? quantification.range[variable] : {});
						cons.prototype.rules = (cons.prototype.rules ? cons.prototype.rules : {});
						cons.prototype.rules[rule.name] = rule;
						cons.prototype.activeKeys = (cons.prototype.activeKeys ? cons.prototype.activeKeys : {});
						conditionstr.replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
							function(match) { 
								var parts = match.split("."),key = parts[1];
								// cache reactive non-function keys on class prototype
								if(key.indexOf("(")===-1) {
									cons.prototype.activeKeys[key] = true;
									// cache what keys are associated with what variables
									quantification.range[variable][key] = true;
								}
								// don't really do a replacement!
								return match;
							}
						);
					});
					// don't really do a replacement!
					return match;
				}
			);
			(condition+"").replace(/forAll\(\s*({.*}),(.*)\)/g,
					function(match,domainstr,conditionstr) {
						var domain = new Function("return " + domainstr)(), variables = Object.keys(domain);
						var quantification = {domain: domain, range: {}};
						rule.triggers.push(quantification);
						variables.forEach(function(variable) {
							var cons = domain[variable];
							quantification.range[variable] = (quantification.range[variable] ? quantification.range[variable] : {});
							cons.prototype.rules = (cons.prototype.rules ? cons.prototype.rules : {});
							cons.prototype.rules[rule.name] = rule;
							cons.prototype.activeKeys = (cons.prototype.activeKeys ? cons.prototype.activeKeys : {});
							conditionstr.replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
								function(match) { 
									var parts = match.split("."),key = parts[1];
									// cache reactive non-function keys on class prototype
									if(key.indexOf("(")===-1) {
										cons.prototype.activeKeys[key] = true;
										// cache what keys are associated with what variables
										quantification.range[variable][key] = true;
									}
									// don't really do a replacement!
									return match;
								}
							);
						});
						// don't really do a replacement!
						return match;
					}
				);
		});
		rule.compiledConditions = [];
		rule.conditions.forEach(function(condition,i) {
			if((condition+"").indexOf("return")===-1) {
				throw new TypeError("Condition function missing a return statement in rule '" + rule.name + "' condition " + i);
			}
			var args = getFunctionArgs(condition);
			condition.required = new Array(args.length);
			args.forEach(function(arg,j) {
				var required = variables.indexOf(arg);
				if(required===-1) {
					throw new ReferenceError("Referenced domain variable '" + arg + "' undefined in rule '" + rule.name + "' condition ",i);
				}
				condition.required[j] = required;
			});
			rule.compiledConditions.push(function(match) {
				var me = this, args = [];
				// no required = domainless
				if(!condition.required || condition.required.every(function(i) {
					if(match[i]!==undefined) {
						return args.push(match[i]);
					}
				})) {
					return condition.apply(me,args);
				}
				return true;
			});
		});
		var args = getFunctionArgs(rule.action);
		rule.action.required = new Array(args.length);
		args.forEach(function(arg,i) {
			var required = variables.indexOf(arg);
			if(required===-1) {
				throw new ReferenceError("Referenced domain variable '" + arg + "' undefined in rule '" + rule.name + "' action");
			}
			rule.action.required[i] = required;
			
		});
		rule.compiledAction = function(match) {
			var me = this, args = [];
			// no required = domainless
			if(!rule.action.required || rule.action.required.every(function(i) {
				if(match[i]!==undefined) {
					return args.push(match[i]);
				}
			})) {
				rule.action.apply(me,args);
			}
		};
	}

	// dummy console so logging can easily be retractd
	var Console = {};
	Console.log = function() { 
		console.log.apply(console,arguments); 
	};
	// uncomment line below to retract logging
	//Console.log = function() {};

	function Activation(rule,match,index,bindings,instance) {
		var me = this;
		me.rule = rule;
		me.match = match;
		me.index = index;
		me.bindings = bindings;
		me.instance = instance;
		me.rule.activated++;
		if(!me.rule.reactor.agenda.some(function(activation,i) {
			if(activation.rule.salience>me.rule.salience) {
				me.rule.reactor.agenda.splice(i,0,me);
				return true;
			}
		})) {
			me.rule.reactor.agenda.push(me);
		}
		var activations = rule.activations.get(instance);
		if(!activations) {
			activations = [];
		}
		activations.push(me);
		rule.activations.set(instance,activations);
		if(me.rule.reactor.tracelevel>1) {
			Console.log("Activating: ",rule,match);
		}
	}
	Activation.prototype.execute = function(index) {
		var me = this;
		// re-test just in-case
		me.delete(undefined,index,true);
		if((!me.bindings || me.bindings.verify(me.index,me.match)) && me.rule.compiledConditions.every(function(condition) {
			return condition.call(me,me.match);
		})) {
			me.rule.fire(me.match);
		}
	}
	Activation.prototype.delete = function(instance,index,supresslog) {
		var me = this;
		if(!instance || me.match.indexOf(instance)>=0) {
			if(!supresslog && me.rule.reactor.tracelevel>1) {
				Console.log("Deactivating: ",me.rule,me.match);
			}
			var activations = me.rule.activations.get(me.instance);
			if(activations) {
				var i = activations.indexOf(me);
				if(i>=0) {
					activations.splice(i,1);
				}
			}
			if(index!=undefined) {
				if(index===me.rule.reactor.agenda.length-1) {
					me.rule.reactor.agenda.pop();
					return;
				}
				me.rule.reactor.agenda.splice(index,1);
				return;
			}
			var i = me.rule.reactor.agenda.indexOf(me);
			if(i>=0) {
				me.rule.reactor.agenda.splice(i,1);
			}
		}
	}

	function Rule(reactor,name,salience,domain,condition,action) {
		var me = this;
		me.name = name;
		me.reactor = reactor;
		if(typeof(salience)!=="number") {
			throw new TypeError("Salience " + salience + " is not a number in rule " + name);
		}
		me.salience = salience;
		me.domain = domain;
		if(typeof(domain)!=="object") {
			throw new TypeError("Domain " + domain + " is not an object in rule " + name);
		}
		me.range = {};
		me.triggers = [];
		me.conditions = (Array.isArray(condition) || condition instanceof Array ? condition : [condition]);
		me.pattern = new Array(Object.keys(domain).length);
		if(typeof(action)!=="function") {
			throw new TypeError("Action " + action + " is not a function in rule " + name);
		}
		me.action = action;
		me.bindings = {};
		me.activations = new Map();
		me.potentialMatches = 0;
		me.tested = 0;
		me.activated = 0;
		me.fired = 0;
		compile.call(reactor,this);
		if(me.reactor.tracelevel>2) {
			Console.log("New Rule: ",this);
		}
	} 
	Rule.prototype.bind = function(instance,test) {
		var me = this, variables = Object.keys(me.bindings), values = [];
		variables.map(function(variable) {
			if(instance instanceof me.domain[variable] && me.bindings[variable].indexOf(instance.__rrid__)===-1) {
				if(me.reactor.tracelevel>2) {
					Console.log("Binding: ",me,variable,instance);
				}
				me.bindings[variable].push(instance);
			}
		});
		if(variables.every(function(variable,i) {
			values.push(me.bindings[variable]);
			return me.bindings[variable].length>0;
		})) {
			if(!me.cxproduct) {
				me.cxproduct = new CXProduct().add(values);
			}
			if(test) {
				me.test(instance);
			}
		}
	}
	Rule.prototype.delete = function() {
		var me = this, variables = Object.keys(me.domain);
		variables.forEach(function(variable) {
			var cons = me.domain[variable];
			delete cons.prototype.rules[me.name];
		});
	}
	Rule.prototype.fire = function(match) {
		var me = this;
		if(me.reactor.tracelevel>0) {
			Console.log("Firing: ",this,match);
		}
		this.fired++;
		this.compiledAction(match);
	}
	Rule.prototype.test = function(instance,key,callback) { 
		var me = this, variables = Object.keys(me.domain), result = false, values = [];
		if(!variables.every(function(variable) {
			values.push(me.bindings[variable]);
			return me.bindings[variable].length>0;
		})) {
			return result;
		}
		if(me.reactor.tracelevel>2) {
			Console.log("Testing: ",me,instance,key);
		}
		me.tested++;
		var test = function(match) {
			return me.compiledConditions.every(function(condition) {
				return condition.call(me,match);
			});
		}
		if(me.cxproduct) {
			me.potentialMatches = Math.max(me.potentialMatches,me.cxproduct.size);
		}
		if(instance) {
			variables.forEach(function(variable,i) {
				var collections = me.cxproduct.collections.slice(0);
				if(instance instanceof me.domain[variable]) {
					collections[i] = [instance];
					var cxproduct = new CXProduct(collections);
					cxproduct.forEach(function(match,i) {
						new Activation(me,match,i,cxproduct,instance);
						result = true;
					},undefined,test); //me.conditions);
				}
			});
		} else if(me.cxproduct) {
			me.cxproduct.forEach(function(match,i) {
				new Activation(me,match,i,me.cxproduct);
				result = true;
			},undefined,test); //me.conditions);
		} else {
			// tests domainless rules
			if(test()) {
				new Activation(me);
				result = true;
			} else {
				me.reset(instance);
			}
		}
		if(callback) {
			callback(null,result);
		} else {
			return result;
		}
	}
	Rule.prototype.reset = function(retest,instance) {
		var me = this;
		if(me.reactor.tracelevel>2) {
			Console.log("Reseting: ",me,instance);
		}
		me.activations.forEach(function(activations,activator) {
			if(!instance || activator===instance) {
				activations.forEach(function(activation) {
					var i = me.reactor.agenda.indexOf(activation);
					if(i>=0) {
						me.reactor.agenda.splice(i,1);
					}
				});
				
			}
		});
		if(retest) {
			me.test(instance);
		}
	}
	
	Rule.prototype.unbind = function(instance) {
		var me = this, variables = Object.keys(me.bindings);
		variables.map(function(variable) {
			var i = me.bindings[variable].indexOf(instance);
			if(i>=0) {
				if(me.reactor.tracelevel>2) {
					Console.log("Unbinding: ",me,variable,instance);
				}
				me.bindings[variable].splice(i,1);
				if(me.bindings[variable].length===0) {
					me.cxproduct = null;
					me.reset(false);
				} else {
					me.reset(false,instance);
				}
			}
		});
	}

	function indexObject(index,instance) {
		var keys = Object.keys(instance);
		keys.forEach(function(key) {
			index[key] = (index[key] ? index[key] : {});
			var value = instance[key], type = typeof(value), valuekey, typekey;
			if(type==="object" && value) {
				if(value.__rrid__===undefined) {
					Object.defineProperty(value,"__rrid__",{value:uuid.v4()});
				}
				valuekey = value.constructor.name + "@" + value.__rrid__;
			} else {
				valuekey = value;
			}
			if(value===null || value===undefined) {
				typekey = "undefined";
			} else {
				typekey = type;
			}
			index[key][valuekey] = (index[key][valuekey] ? index[key][valuekey] : {});
			index[key][valuekey][typekey] = (index[key][valuekey][typekey] ? index[key][valuekey][typekey] : {});
			index[key][valuekey][typekey][instance.__rrid__] = instance;
		});
	}
	function updateIndex(index,instance,key,oldValue) {
		if(instance[key]===undefined && !index[key]) return;
		index[key] = (index[key] ? index[key] : {});
		var value = instance[key], type = typeof(value), oldtype = typeof(oldValue), oldvaluekey, oldtypekey, valuekey, typekey;
		if(type==="object" && value) {
			if(value.__rrid__===undefined) {
				Object.defineProperty(value,"__rrid__",{value:uuid.v4()});
			}
			valuekey = value.constructor.name + "@" + value.__rrid__;
		} else {
			valuekey = value;
		}
		if(value===null || value===undefined) {
			typekey = "undefined";
		} else {
			typekey = type;
		}
		if(oldtype==="object" && oldValue) {
			oldvaluekey = oldValue.constructor.name + "@" + oldValue.__rrid__;
		} else {
			oldvaluekey = oldValue;
		}
		if(value===null || value===undefined) {
			typekey = "undefined";
		} else {
			typekey = type;
		}
		if(oldValue===null || oldValue===undefined) {
			oldtypekey = "undefined";
		} else {
			oldtypekey = oldtype;
		}
		index[key][valuekey] = (index[key][valuekey] ? index[key][valuekey] : {});
		index[key][valuekey][typekey] = (index[key][valuekey][typekey] ? index[key][valuekey][typekey] : {});
		index[key][valuekey][typekey][instance.__rrid__] = instance;
		if(index[key][oldvaluekey] && index[key][oldvaluekey][oldtypekey]) {
			delete index[key][oldvaluekey][oldtypekey][instance.__rrid__];
		}
	}
	function matchObject(index,instance,parentkeys,parentinstances) {
		var parentkeys = (parentkeys ? parentkeys : []), 
			parentinstances = (parentinstances ? parentinstances : []),
			keys = Object.keys(instance);
		return keys.every(function(key) {
			if(!index[key]) return false;
			var value = instance[key], type = typeof(value), valuekey, typekey;
			if(type==="object" && value) {
				if(parentkeys.indexOf(key)>=0 && parentkeys.indexOf(key)===parentinstances.indexOf(value)) {
					return true;
				}
				var valuekeys = Object.keys(index[key]);
				return valuekeys.some(function(valuekey) {
					var parts = valuekey.split("@");
					if(parts.length!==2) {
						return false;
					}
					var cons = Function("return " + parts[0])();
					if(typeof(cons)!=="function" || !cons.index) {
						return false;
					}
					parentkeys.push(key);
					parentinstances.push(value);
					return matchObject(cons.index,value,parentkeys,parentinstances);
				});
			} else {
				valuekey = value;
			}
			if(value===null || value===undefined) {
				typekey = "undefined";
			} else {
				typekey = type;
			}
			if(!index[key][valuekey]) return false;
			if(!index[key][valuekey][typekey]) return false;
			if(instance.__rrid__ && !index[key][valuekey][typekey][instance.__rrid__]) return false;
			return true;
		});
	}
	function RuleReactor () {
		this.rules = {};
		this.triggerlessRules = {};
		this.data = new Map();
		this.agenda = [];
	}
	RuleReactor.prototype.assert = function(instances,callback) {
		var me = this;
		// add instance to class.constructor.instances
		instances = (Array.isArray(instances) || instances instanceof Array ? instances : [instances]);
		var instancestoprocess = [];
		instances.forEach(function(instance) {
			// don't bother processing instances that don't impact rules or are already in the data store
			if(instance && typeof(instance)==="object") { // !RuleReactor.data.has(instance)
				if(instance.__rrid__===undefined) {
					Object.defineProperty(instance,"__rrid__",{value:uuid.v4()});
				}
				if(me.data.has(instance.__rrid)) {
					return;
				}
				if(me.tracelevel>2) {
					Console.log("Assert: ",instance);
				}
				me.data.set(instance.__rrid__,instance);
				me.dataModified = true;
				instancestoprocess.push(instance);
				instance.constructor.instances = (instance.constructor.instances ? instance.constructor.instances : []);
				instance.constructor.instances.push(instance);
				instance.constructor.index = (instance.constructor.index ? instance.constructor.index : {});
				indexObject(instance.constructor.index,instance);
				// patch any keys on instance or those identified as active while compiling
				var keys = Object.keys(instance);
				if(instance.activeKeys) {
					Object.keys(instance.activeKeys).forEach(function(key) {
						if(keys.indexOf(key)===-1) {
							keys.push(key);
						}
					});
				}
				Object.keys(instance.activeKeys).forEach(function(key) {
					function rrget() {
						return rrget.value;
					}
					function rrset(value) {
						if(rrget.value!==value) {
							if(me.tracelevel>2) {
								Console.log("Modify: ",instance,key,rrget.value,"=>",value);
							}
							var oldvalue = rrget.value;
							// set new value
							rrget.value = value;
							updateIndex(instance.constructor.index,instance,key,oldvalue);
							me.dataModified = true;
							// if the value is an object that has possible rule matches, assert it
							if(value && value.rules) {
								me.assert(value);
							}
							// re-test the rules that pattern match the key
							Object.keys(instance.rules).forEach(function(rulename) {
								var rule = instance.rules[rulename];
								if(rule.triggers.some(function(trigger) {
									return Object.keys(trigger.range).some(function(variable) {
										return trigger.range[variable][key] && instance instanceof trigger.domain[variable];
								})})) {
									var activations = rule.activations.get(instance);
									if(activations) {
										activations.forEach(function(activation) {
											activation.delete();
										});
									}
									rule.test(instance,key);
								}
							});
							return rrget.value;
						}
					}
					var desc = Object.getOwnPropertyDescriptor(instance,key);
					var originalDescriptor;
					if(desc) {
						originalDescriptor = {};
						Object.keys(desc).forEach(function(key) {
							originalDescriptor[key] = desc[key];
						});
					}
					// create a new descriptor if one does not exist
					desc = (desc ? desc : {enumerable:true,configurable:false});
					if(!desc.get || desc.get.name!=="rrget") {
						// rrget existing value
						rrget.value = desc.value;
						rrget.originalDescriptor = originalDescriptor;
						// modify arrays
						if(desc.value instanceof Array || Array.isArray(desc.value)) {
							var value = desc.value;
							originalDescriptor.value = value.slice();
							var modifiers = ["push","pop","splice","shift","unshift"];
							modifiers.forEach(function(fname) {
								var f = value[fname];
								if(typeof(f)==="function") {
									var newf = function() {
										f.apply(value,arguments);
										// re-test the rules that pattern match the key
										Object.keys(instance.rules).forEach(function(rulename) {
											var rule = instance.rules[rulename];
											if(rule.triggers.some(function(trigger) {
												return Object.keys(trigger.range).some(function(variable) {
													return trigger.range[variable][key] && instance instanceof trigger.domain[variable];
											})})) {
												var activations = rule.activations.get(instance);
												if(activations) {
													activations.forEach(function(activation) {
														activation.delete();
													});
												}
												rule.test(instance,key);
											}
										});
									}
									Object.defineProperty(rrget.value,fname,{configurable:true,writable:true,value:newf});
								}
							});
							Object.getOwnPropertyNames(Array.prototype).forEach(function(fname) {
								var f = value[fname];
								if(typeof(f)==="function" && modifiers.indexOf(fname)===-1) {
									Object.defineProperty(rrget.value,fname,{configurable:true,writable:true,value:function() {
										return f.apply(value,arguments);
									}});
								}
							});
						}
						// delete descriptor properties that are inconsistent with rrget/rrset
						delete desc.value;
						delete desc.writable;
						desc.get = rrget;
						desc.set = rrset;
						Object.defineProperty(instance,key,desc);
						
					}
				});
			}
		});
		instancestoprocess.forEach(function(instance) {
			if(instance.rules) {
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					instance.rules[ruleinstance].bind(instance);
				});
			}
		});
		// test all associated rules
		var rulestotest = {};
		instancestoprocess.forEach(function(instance) {
			if(instance.rules) {
				Object.keys(instance.rules).forEach(function(rulename) {
					//promises.push(instance.rules[ruleinstance].test(instance));
					rulestotest[rulename] = instance.rules[rulename];
				});
			}
		});
		Object.keys(rulestotest).forEach(function(rulename) {
			rulestotest[rulename].test();
		});
		if(callback) {
			callback(null);
		}
	}
	RuleReactor.prototype.createRule = function(name,salience,domain,condition,action) {
		var me = this, rule = new Rule(this,name,salience,domain,condition,action);
		me.rules[rule.name] = rule;
		if(rule.triggers.length===0) {
			me.triggerlessRules[rule.name] = rule;
		}
		return rule;
	}
	RuleReactor.prototype.forAll = function(domain,test) {
		if(typeof(domain)!=="object") {
			throw new TypeError("Domain " + domain + " is not an object in universal quantification");
		}
		if((test+"").indexOf("return ")===-1) {
			throw new TypeError("Universal quantification condition function missing a return statement: " + test);
		}
		if(!test.cxproduct) {
			var variables = Object.keys(domain), collections = [], args;
			variables.forEach(function(variable) {
				domain[variable].instances = (domain[variable].instances ? domain[variable].instances: [])
				collections.push(domain[variable].instances);
			});
			test.cxproduct = new CXProduct(collections);
			args = getFunctionArgs(test);
			if(args.length>0) {
				test.required = args.map(function(variable) { 
					var i = variables.indexOf(variable);
					if(i===-1) {
						throw new ReferenceError("Undeclared domain variable '" + variable + "' in universal quantification condition function");
					}
					return i; 
				});
			}
		}
		return test.cxproduct.every(function(row) {
			var args = [];
			if(!test.required || test.required.every(function(index) { args.push(row[index]); return row[index]!==undefined; })) {
				return test.apply(null,args);
			}
		});
	}
	RuleReactor.prototype.exists = function(domain,test) {
		if(typeof(domain)!=="object") {
			throw new TypeError("Domain " + domain + " is not an object in existential quantification");
		}
		var variables = Object.keys(domain);
		if(typeof(test)==="object") {
			if(!test) {
				throw new TypeError("Existential quantification condition is null");
			}
			return Object.keys(test).every(function(variable) {
				var i = variables.indexOf(variable);
				if(i===-1) {
					throw new ReferenceError("Undeclared domain variable '" + variable + "' in existential quantification match condition");
				}
				return matchObject(domain[variable].index,test[variable]);
			});
		}
		if((test+"").indexOf("return ")===-1) {
			throw new TypeError("Existential quantification condition function missing a return statement: " + test);
		}
		if(!test.cxproduct) {
			var collections = [], args;
			variables.forEach(function(variable) {
				domain[variable].instances = (domain[variable].instances ? domain[variable].instances: [])
				collections.push(domain[variable].instances);
			});
			test.cxproduct = new CXProduct(collections);
			args = getFunctionArgs(test);
			if(args.length>0) {
				test.required = args.map(function(variable) { 
					var i = variables.indexOf(variable);
					if(i===-1) {
						throw new ReferenceError("Undeclared domain variable '" + variable + "' in existential quantification condition function");
					}
					return i; 
				});
			}
		}
		return test.cxproduct.some(function(row) {
			var args = [];
			if(!test.required || test.required.every(function(index) { args.push(row[index]); return row[index]!==undefined; })) {
				return test.apply(null,args);
			}
		});
	}
	RuleReactor.prototype.not = function(value) {
		return !value;
	}
	RuleReactor.prototype.retract = function(instances,run) {
		var me = this;
		instances = (Array.isArray(instances) || instances instanceof Array ? instances : [instances]);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				if(me.tracelevel>2) {
					Console.log("Retract: ",instance);
				}
				// retract from data
				me.data.delete(instance.__rrid__);
				me.dataModified = true;
				// restore instance properties
				Object.keys(instance).forEach(function(key) {
					var desc = Object.getOwnPropertyDescriptor(instance,key);
					if(desc.get && desc.get.name==="rrget") {
						if(typeof(desc.get.originalDescriptor)==="undefined") {
							delete instance[key];
						} else {
							if(desc.get.originalDescriptor.value instanceof Array || Array.isArray(desc.get.originalDescriptor.value)) {
								if(instance[key] instanceof Array || Array.isArray(instance[key])) {
									var args = [0,instance[key]].concat(desc.get.originalDescriptor.value);
									instance[key].splice.apply(instance[key],args);
								} else {
									instance[key] = desc.get.originalDescriptor.value;
								}
							}
							Object.defineProperty(instance,key,desc.get.originalDescriptor);
						}
					}
				});
				// unbind from all associated rules
				Object.keys(instance.rules).forEach(function(rulename) {
					instance.rules[rulename].unbind(instance);
				});

			}
		});
		if(run) {
			setTimeout(function() { me.run(); });
		}
	}
	RuleReactor.prototype.reset = function(facts) {
		var me = this;
		Object.keys(me.rules).forEach(function(rulename) {
			me.rules[rulename].reset();
		});
		if(facts) {
			var data = [];
			me.data.forEach(function(instance) {
				data.push(instance);
			});
			me.retract(data,false);
		}
	}
	RuleReactor.prototype.run = function(max,loose,callback) {
		var me = this;
		function run(loose) {
			while (me.agenda.length>0 && me.run.executions<me.run.max) {
				me.run.executions++;
				me.dataModified = false;
				me.agenda[me.agenda.length-1].execute(me.agenda.length-1);
				if(me.dataModified===true) {
					// causes a loop, put in assert? .. but then doe snot run
					Object.keys(me.triggerlessRules).forEach(function(rulename) {
						me.triggerlessRules[rulename].test();
					});
				}
				if(loose) {
					setTimeout(run,0,loose);
					return;
				}
			}
			me.run.stop = new Date();
			me.run.rps = (me.run.executions / (me.run.stop.getTime() - me.run.start.getTime())) * 1000;
			me.run.running = false;
			if(me.tracelevel>0) {
				Console.log("Data Count: ",me.data.size);
				Console.log("Executions: ",me.run.executions);
				Console.log("RPS: ",me.run.rps);
			}
			if(me.tracelevel>1) {
				Object.keys(me.rules).forEach(function(rulename) {
					var rule = me.rules[rulename];
					Console.log(rule.name,rule.potentialMatches,rule.tested,rule.activated,rule.fired);
				});
			}
			if(typeof(callback)==="function") {
				callback();
			}
		}
		if(me.run.running) { return true; }
		me.run.max = (max ? max : Infinity);
		me.run.running = true;
		me.run.executions = 0;
		me.run.start = new Date();
		if(me.tracelevel>0) {
			Console.log("Run: ",max,loose);
		}
		run(loose);
	}
	RuleReactor.prototype.trace = function(level) {
		this.tracelevel = level;
	}

	if (this.exports) {
		this.exports  = RuleReactor;
	} else if (typeof define === "function" && define.amd) {
		// Publish as AMD module
		define(function() {return RuleReactor;});
	} else {
		this.RuleReactor = RuleReactor;
	}
}).call((typeof(window)!=="undefined" ? window : (typeof(module)!=="undefined" ? module : null)));

