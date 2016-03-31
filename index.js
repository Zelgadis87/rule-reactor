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


(function() {
	"use strict";

	var RuleReactor = {};

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
		return result;
	}
	function compile(rule) {
		var variables = Object.keys(rule.domain), domains = {};
		variables.forEach(function(variable) {
			if(!domains[variable]) {
				domains[variable]=0;
			}
			domains[variable]++;
		});
		variables.forEach(function(variable) {
			var cons = rule.domain[variable];
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
			rule.conditions.forEach(function(condition) {
				if(!condition.required) {
					var args = getFunctionArgs(condition);
					condition.required = new Array(args.length);
					args.forEach(function(arg,i) {
						condition.required[i] = variables.indexOf(arg);
					});
				}
				condition.range = (condition.range ? condition.range : {})
				condition.range[variable] = {};
				(condition+"").replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
					function(match) { 
						var parts = match.split("."),key = parts[1];
						// cache reactive keys on class prototype
						cons.prototype.activeKeys[key] = true;
						// cache what keys are associated with what variables
						rule.range[variable][key] = (rule.range[variable][key] ? rule.range[variable][key] : true);
						condition.range[variable][key] = (condition.range[variable][key] ? condition.range[variable][key] : true);
						// don't really do a replacement!
						return match;
					}
				);
			});
			var args = getFunctionArgs(rule.action);
			if(args.indexOf(variable)>=0) {
				rule.action.domain = (rule.action.domain ? rule.action.domain : {});
				rule.action.domain[variable] = true;
			}
		});
		rule.compiledConditions = [];
		rule.conditions.forEach(function(condition,i) {
			rule.compiledConditions.push(function(match) {
				var me = this, args = [];
				if(condition.required.every(function(i) {
					if(match[i]!==undefined) {
						return args.push(match[i]);
					}
				})) {
					return condition.apply(me,args);
				}
				return true;
			});
		});
	}

	// dummy console so logging can easily be removed
	var Console = {};
	Console.log = function() { 
		console.log.apply(console,arguments); 
	};
	// uncomment line below to remove logging
	//Console.log = function() {};

	function Activation(rule,match,index,bindings,instance) {
		var me = this;
		me.rule = rule;
		me.match = match;
		me.index = index;
		me.bindings = bindings;
		me.instance = instance;
		if(!RuleReactor.agenda.some(function(activation,i) {
			if(activation.rule.salience<=me.rule.salience) {
				RuleReactor.agenda.splice(i,0,me);
				return true;
			}
		})) {
			RuleReactor.agenda.push(me);
		}
		var activations = rule.activations.get(instance);
		if(!activations) {
			activations = [];
			rule.activations.set(instance,[]);
		}
		activations.push(me);
		if(RuleReactor.tracelevel>1) {
			Console.log("Activating: ",rule,match);
		}
	}
	Activation.prototype.execute = function() {
		var me = this;
		if(me.bindings.verify(me.index,me.match) && me.rule.compiledConditions.every(function(condition) {
			return condition.call(me,me.match);
		})) {
			if(RuleReactor.tracelevel>0) {
				Console.log("Firing: ",this.rule,this.match);
			}
			me.rule.fire(me.match);
		}
		me.delete();
	}
	Activation.prototype.delete = function(instance) {
		var me = this;
		if(!instance || me.match.indexOf(instance)>=0) {
			if(RuleReactor.tracelevel>1) {
				Console.log("Deactivating: ",me.rule,me.match);
			}
			var activations = me.rule.activations.get(me.instance);
			if(activations) {
				var i = activations.indexOf(me);
				if(i>=0) {
					activations.splice(i,1);
				}
			}
			var i = RuleReactor.agenda.indexOf(me);
			if(i>=0) {
				RuleReactor.agenda.splice(i,1);
			}
		}
	}

	function Rule(name,salience,domain,condition,action) {
		this.name = name;
		this.salience = salience;
		this.domain = domain;
		this.range = {};
		this.conditions = (Array.isArray(condition) || condition instanceof Array ? condition : [condition]);
		this.pattern = new Array(Object.keys(domain).length);
		this.action = action;
		this.bindings = {};
		this.activations = new Map();
		this.options = {optimize:"stack"};
		compile(this);
		if(RuleReactor.tracelevel>2) {
			Console.log("New Rule: ",this);
		}
	} 
	Rule.prototype.bind = function(instance,test) {
		var me = this, variables = Object.keys(me.bindings), values = [];
		variables.map(function(variable) {
			if(instance instanceof me.domain[variable] && me.bindings[variable].indexOf(instance.__rrid__)===-1) {
				if(RuleReactor.tracelevel>2) {
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
	};
	Rule.prototype.fire = function(match) {
		var me = this, variables = Object.keys(me.domain), args = [];
		Object.keys(me.action.domain).forEach(function(actionvariable) {
			args.push(match[variables.indexOf(actionvariable)]);
		});
		me.action.apply(me,args);
	}
	Rule.prototype.setOptions = function(options) {
		var me = this;
		Object.keys(options).forEach(function(key) {
			me.options[key] = options[key];
		});
	}
	Rule.prototype.test = function(instance,key,callback) { 
		var me = this, variables = Object.keys(me.domain), result = false, values = [];
		if(!variables.every(function(variable) {
			values.push(me.bindings[variable]);
			return me.bindings[variable].length>0;
		})) {
			return result;
		}
		if(RuleReactor.tracelevel>2) {
			Console.log("Testing: ",me,instance,key);
		}
		
		var test = function(match) {
			return me.compiledConditions.every(function(condition) {
				return condition.call(me,match);
			});
		}
		if(instance) {
			variables.forEach(function(variable,i) {
				var collections = me.cxproduct.collections.slice(0);
				if(instance instanceof me.domain[variable]) {
					collections[i] = [instance];
					var cxproduct = new CXProduct(collections);
					cxproduct.forEach(function(match,i) {
						new Activation(me,match,i,cxproduct);
						result = true;
					},undefined,test); //me.conditions);
				}
			});
		} else {
			me.cxproduct.forEach(function(match,i) {
				new Activation(me,match,i,me.cxproduct);
				result = true;
			},undefined,test); //me.conditions);
		}
		if(callback) {
			callback(null,result);
		} else {
			return result;
		}
	}
	Rule.prototype.reset = function(retest,instance) {
		var me = this;
		if(RuleReactor.tracelevel>2) {
			Console.log("Reseting: ",me,instance);
		}
		me.activations.forEach(function(activations,activator) {
			if(!instance || activator===instance) {
				activations.forEach(function(activation) {
					var i = RuleReactor.agenda.indexOf(activation);
					if(i>=0) {
						RuleReactor.agenda.splice(i,1);
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
				if(RuleReactor.tracelevel>2) {
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

	RuleReactor.rules = {};
	RuleReactor.data = []; new Map();
	RuleReactor.agenda = [];
	RuleReactor.createRule = function(name,salience,domain,condition,action) {
		var rule = new Rule(name,salience,domain,condition,action);
		RuleReactor.rules[rule.name] = rule;
		return rule;
	}
	RuleReactor.get = function(idOrObject) {
		if(typeof(idOrObject)==="number") {
			return RuleReactor.data[idOrObject];
		}
		return RuleReactor.data[RuleReactor.data.indexOf(idOrObject)];
	}
	RuleReactor.insert = function(instances,callback) {
		// add instance to class.constructor.instances
		instances = (Array.isArray(instances) || instances instanceof Array ? instances : [instances]);
		var instancestoprocess = [];
		instances.forEach(function(instance) {
			// don't bother processing instances that don't impact rules or are already in the data store
			if(instance && typeof(instance)==="object" && instance.__rrid__===undefined) { // !RuleReactor.data.has(instance)
				if(RuleReactor.tracelevel>2) {
					Console.log("Insert: ",instance);
				}
				Object.defineProperty(instance,"__rrid__",{value:RuleReactor.data.length});
				RuleReactor.data.push(instance);
				instancestoprocess.push(instance);
				// need to change instances to JOQULAR like index
				instance.constructor.instances = (instance.constructor.instances ? instance.constructor.instances : []);
				instance.constructor.instances.push(instance);
				// patch any keys on instance or those identified as active while compiling
				var keys = Object.keys(instance);
				if(instance.activeKeys) {
					Object.keys(instance.activeKeys).forEach(function(key) {
						if(keys.indexOf(key)===-1) {
							keys.push(key);
						}
					});
				}
				keys.forEach(function(key) {
					function rrget() {
						return rrget.value;
					}
					function rrset(value) {
						if(rrget.value!==value) {
							if(RuleReactor.tracelevel>2) {
								Console.log("Modify: ",instance,key,rrget.value,"=>",value);
							}
							// set new value
							rrget.value = value;
							// if the value is an object that has possible rule matches, insert it
							if(value && value.rules) {
								RuleReactor.insert(value);
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
	RuleReactor.not = function(value) {
		return !value;
	}
	RuleReactor.remove = function() {
		var run = run = (arguments[arguments.length-1] instanceof Object ? false : arguments[arguments.length-1]);
		var instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				if(RuleReactor.tracelevel>2) {
					Console.log("Remove: ",instance);
				}
				// remove from data
				RuleReactor.data.delete(instance);
				// restore instance properties
				Object.keys(instance).forEach(function(key) {
					var desc = Object.getOwnPropertyDescriptor(instance,key);
					if(desc.get.name==="rrget") {
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
			setTimeout(function() { RuleReactor.run(); });
		}
	}
	RuleReactor.reset = function(facts) {
		Object.keys(RuleReactor.rules).forEach(function(rulename) {
			RuleReactor.rules[rulename].reset();
		});
		if(facts) {
			var data = [];
			RuleReactor.data.forEach(function(instance) {
				data.push(instance);
			});
			data.push(false);
			RuleReactor.remove(data,false);
		}
	}
	RuleReactor.run = function(max,loose,callback) {
		function run(loose) {
			while (RuleReactor.agenda.length>0 && RuleReactor.run.executions<RuleReactor.run.max) {
				RuleReactor.run.executions++;
				RuleReactor.agenda[RuleReactor.agenda.length-1].execute();
				if(loose) {
					setTimeout(run,0,loose);
					return;
				}
			}
			RuleReactor.run.stop = new Date();
			RuleReactor.run.rps = (RuleReactor.run.executions / (RuleReactor.run.stop.getTime() - RuleReactor.run.start.getTime())) * 1000;
			RuleReactor.run.running = false;
			if(typeof(callback)==="function") {
				callback();
			}
		}
		if(RuleReactor.run.running) { return true; }
		RuleReactor.run.max = (max ? max : Infinity);
		RuleReactor.run.running = true;
		RuleReactor.run.executions = 0;
		RuleReactor.run.start = new Date();
		if(RuleReactor.tracelevel>0) {
			Console.log("Run: ",max,loose);
		}
		run(loose);
	}
	RuleReactor.trace = function(level) {
		RuleReactor.tracelevel = level;
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

