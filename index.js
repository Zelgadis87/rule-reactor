//rule-reactor

//Copyright (c) 2016 Simon Y. Blackwell, AnyWhichWay
//MIT License - http://opensource.org/licenses/mit-license.php
(function() {
	"use strict";
	function crossproduct(arrays) {
		var result = [],
		indices = Array(arrays.length);
		(function backtracking(index) {
			if(index === arrays.length) {
				var row = arrays.map(function(array,index) {
					return array[indices[index]];
				});
				return result.push(row);
			}
			for(var i=0; i<arrays[index].length; ++i) {
				indices[index] = i;
				backtracking(index+1);
			}
		})(0);
		return result;
	}

	function compile(rule) {
		Object.keys(rule.scope).forEach(function(variable) {
			var cons = rule.scope[variable];
			cons.prototype.patternKeys = (cons.prototype.patternKeys ? cons.prototype.patternKeys : {});
			cons.prototype.rules = (cons.prototype.rules ? cons.prototype.rules : {});
			cons.prototype.rules[rule.name] = rule;
			cons.exists = function(f) {
				return cons.instances && cons.instances.some(function(instance) {
					return f(instance);
				});
			};
			cons.forall = function(f) {
				return cons.instances && cons.instances.every(function(instance) {
					return f(instance);
				});
			};
			rule.keys[variable] = {};
			rule.bindings[variable] = (rule.bindings[variable] ? rule.bindings[variable] : []);
			// extract instance keys from condition using a side-effect of
			// replace
			(rule.condition+"").replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
					function(match) { 
				var key = match.split(".")[1];
				// cache what keys are associated with what variables
				rule.keys[variable][key] = (rule.keys[variable][key] ? rule.keys[variable][key] : true);
				// cache rules and variables impacted by key changes
				cons.prototype.patternKeys[key] = (cons.prototype.patternKeys[key] ? cons.prototype.patternKeys[key] : {});
				cons.prototype.patternKeys[key][rule.name] = rule;
				// don't really do a replacement!
				return match;
			}
			);

		});
	}
	
	function Rule(name,salience,scope,condition,action) {
		this.name = name;
		this.salience = salience;
		this.scope = scope;
		this.keys = {};
		this.condition = condition;
		this.action = action;
		this.bindings = {};

		compile(this);
	} 
	Rule.prototype.bind = function(instance) {
		var me = this;
		Object.keys(me.bindings).forEach(function(variable) {
			if(instance instanceof me.scope[variable]) {
				me.bindings[variable].push(instance);
			}
		});
	}
	Rule.prototype.unbind = function(instance) {
		var me = this;
		Object.keys(me.bindings).forEach(function(variable) {
			var i = me.bindings[variable].indexOf(instance);
			if(i>=0) {
				me.bindings[variable].splice(i,1);
			}
		});
	}
	Rule.prototype.test = function(variable,instance) { // should we just test
		// for instance not
		// variables
		var me = this;
		var tests = [], variables = Object.keys(me.bindings);
		var instanceactivations, ruleactivations = RuleReactor.agenda.get(me);
		if(ruleactivations) {
			instanceactivations = ruleactivations.get(instance);
			if(instanceactivations) {
				if(RuleReactor.tracelevel>0) {
					console.log("Deactivating: ",me.name,me,instance,instanceactivations);
				}
				ruleactivations.delete(instance);
			}
		}

		var values = [];
		variables.forEach(function(variablename) {
			if(variablename===variable) {
				values.push([instance]);
			} else {
				values.push(me.bindings[variablename]);
			}
		});
		tests = crossproduct(values);
		instanceactivations = [];
		tests.forEach(function(test) {
			if(me.condition(...test)) {
				instanceactivations.push(test);
			}
		});
		if(instanceactivations.length>0) {
			if(!ruleactivations) {
				ruleactivations = new Map();
				RuleReactor.agenda.set(me,ruleactivations);
			}
			if(RuleReactor.tracelevel>0) {
				console.log("Activating: ",me.name,me,instance,instanceactivations);
			}
			ruleactivations.set(instance,instanceactivations);
		}

	}
	Rule.prototype.reset = function() {
		var me = this;
		var ruleactivations = RuleReactor.agenda.get(me);
		if(ruleactivations) {
			ruleactivations.clear();
			RuleReactor.agenda.delete(me);
		}
		me.test();
	}

	var RuleReactor = {};
	RuleReactor.rules = {};
	RuleReactor.data = new Set();
	RuleReactor.agenda = new Map();
	RuleReactor.trace = function() {
		this.tracelevel = 2;
	}
	RuleReactor.assert = function() {
		// add instance to class.constructor.instances
		// add exists to instance.constructor = function()
		var instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object" && !RuleReactor.data.has(instance)) {
				RuleReactor.data.add(instance);
				instance.constructor.instances = (instance.constructor.instances ? instance.constructor.instances : []);
				instance.constructor.instances.push(instance);
				Object.keys(instance.patternKeys).forEach(function(key) {
					function rrget() {
						return rrget.value;
					}
					function rrset(value) {
						if(rrget.value!==value) {
							rrget.value = value;
							// re-test the rules that pattern match the key
							Object.keys(instance.patternKeys[key]).forEach(function(rulename) {
								instance.patternKeys[key][rulename].test(instance);
							});
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
					desc = (desc ? desc : {enumerable:true,configurable:true});
					if(!desc.get || desc.get.name!=="rrget") {
						// rrget existing value
						rrget.value = desc.value;
						rrget.originalDescriptor = originalDescriptor;
						// modify arrays
						if(rrget.value instanceof Array || Array.isArray(rrget.value)) {
							originalDescriptor.value = rrget.value.slice();
							["push","pop","splice","shift","unshift"].forEach(function(fname) {
								var f = rrget.value[fname];
								rrget.value[fname] = function() {
									f.call(this,...arguments);
									// re-test the rules that pattern match the
									// key
									Object.keys(instance.patternKeys[key]).forEach(function(rulename) {
										instance.patternKeys[key][rulename].test(instance);
									});
								}
								rrget.value[fname].originalFunction = f;
							});
						}
						// delete descriptor properties that are inconsistent
						// with rrget/rrset
						delete desc.value;
						delete desc.writable;
						desc.get = rrget;
						desc.set = rrset;
						Object.defineProperty(instance,key,desc);
					}
				});

				// bind to all associated rules
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					rule.bind(instance);
				});
			}
		});
		// test all associated rules after everything bound
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					Object.keys(rule.keys).forEach(function(variable) {
						// so long as instance is associated with variable
						if(instance instanceof rule.scope[variable]) {
							rule.test(variable,instance);
						}
					});
				});
			}
		});
		if(arguments[arguments.length-1]!==false) {
			this.run();
		}
	}
	RuleReactor.reset = function(facts) {
		var me = this;
		Object.keys(me.rules).forEach(function(rulename) {
			me.rules[rulename].reset();
		});
		if(facts) {
			var data = [];
			me.data.forEach(function(instance) {
				data.push(instance);
			});
			me.retract(...data,false);
		}
	}
	RuleReactor.retract = function() {
		var me = this, instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				// remove from data
				me.data.delete(instance);
				// restore instance properties
				Object.keys(instance).forEach(function(key) {
					var desc = Object.getOwnPropertyDescriptor(instance,key);
					if(desc.get.name==="rrget") {
						if(typeof(desc.get.originalDescriptor)==="undefined") {
							delete instance[key];
						} else {
							if(desc.get.originalDescriptor.value instanceof Array || Array.isArray(desc.get.originalDescriptor.value)) {
								if(instance[key] instanceof Array || Array.isArray(instance[key])) {
									instance[key].splice(0,instance[key],...desc.get.originalDescriptor.value);
								} else {
									instance[key] = desc.get.originalDescriptor.value;
								}
								Object.keys(desc.get.originalDescriptor.value).forEach(function(key) {
									if(typeof(desc.get.originalDescriptor.value[key])==="function" && desc.get.originalDescriptor.value[key].orginalFunction) {
										desc.get.originalDescriptor.value[key] = desc.get.originalDescriptor.value[key].orginalFunction;
									}
								});
							}
							Object.defineProperty(instance,key,desc.get.originalDescriptor);

						}
					}
				});
				// unbind from all associated rules
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					rule.unbind(instance);
				});

			}
		});
		// re-test all associated rules after everything unbound
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					Object.keys(rule.keys).forEach(function(variable) {
						// so long as instance is associated with variable
						if(instance instanceof rule.scope[variable]) {
							rule.test();
						}
					});
				});
			}
		});
		if(arguments[arguments.length-1]!==false) {
			this.run();
		}
	}
	RuleReactor.run = function() {
		function sort(map,f) {
			var array = [];
			map.forEach(function(value,key) {
				array.push([value,key]);
			});
			array.sort(f);
			map.clear();
			array.forEach(function(kv) {
				map.set(kv[1],kv[0]);
			});
			return map;
		}
		var size = RuleReactor.agenda.size;
		while(size>0) {
			// loop through rules on agenda sorted by salience
			for(var [rule,ruleactivations] of sort(RuleReactor.agenda,function(a,b) { return b.salience-a.salience; })) {
				// loop through acivations for rule by variable
				var count = ruleactivations.size;
				for(var [variable,activations] of ruleactivations) {
					count--;
					var matches = activations.pop();
					// process matches
					while(matches) {
						if(RuleReactor.tracelevel>0) {
							console.log("Executing: ",rule.name,rule,matches);
						}
						if(rule.action) {
							rule.action(...matches);
						}
						// if action impacted agenda, then stop processing
						// activation
						if(RuleReactor.agenda.size!==size) {
							size = RuleReactor.agenda.size;
							break;
						}
						matches = activations.pop();
					}
					// if no matches left, drop activations for variable
					if(activations.length===0) {
						ruleactivations.delete(variable);
					}
					if(RuleReactor.agenda.size!==size) {
						size = RuleReactor.agenda.size;
						break;
					}
				}
				// if all ruleactivations processed, then remove rule
				if(count===0) {
					RuleReactor.agenda.delete(rule);
				}
				if(RuleReactor.agenda.size!==size) {
					size = RuleReactor.agenda.size;
					break;
				}
			}
		}
	}
	RuleReactor.createRule = function(name,salience,scope,condition,action) {
		var rule = new Rule(name,salience,scope,condition,action);
		this.rules[rule.name] = rule;
		return rule;
	}
	RuleReactor.not = function(value) {
		return !value;
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