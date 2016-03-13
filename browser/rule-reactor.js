(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//rule-reactor

//Copyright (c) 2016 Simon Y. Blackwell, AnyWhichWay
//MIT License - http://opensource.org/licenses/mit-license.php
(function() {
	"use strict";
	
	var RuleReactor = {};
	
	function crossproduct(arrays,test) {
	  var result = [],
      indices = Array(arrays.length);
	  (function backtracking(index) {
	    if(index === arrays.length) {
	    	var row = arrays.map(function(array,index) {
	            return array[indices[index]];
	        });
	    	if(!test) {
	    		return result.push(row);
	    	} else if(test(row)) {
	    		result.push(row);
	    	}
	    	return result.length;
	    }
	    for(var i=0; i<arrays[index].length; ++i) {
	      indices[index] = i;
	      backtracking(index+1);
	    }
	  })(0);
	  return result;
	}

	function compile(rule) {
		Object.keys(rule.domain).forEach(function(variable) {
			var cons = rule.domain[variable];
			cons.prototype.rules = (cons.prototype.rules ? cons.prototype.rules : {});
			cons.prototype.rules[rule.name] = rule;
			cons.prototype.activeKeys = (cons.prototype.activeKeys ? cons.prototype.activeKeys : {});
			cons.exists = function(f) {
				f = (f ? f : function() { return true; })
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
			var condition = rule.condition+"";
			condition.replace(new RegExp("(\\b"+variable+"\\.\\w+\\b)","g"),
				function(match) { 
					var parts = match.split("."),key = parts[1];
					// cache reactive keys on class prototype
					cons.prototype.activeKeys[key] = true;
					// cache what keys are associated with what variables
					rule.range[variable][key] = (rule.range[variable][key] ? rule.range[variable][key] : true);
					// don't really do a replacement!
					return match;
			});
		});
	}
	
	var Console = {};
	Console.log = function() { 
		console.log.apply(console,arguments); 
	}
	
	
	function Rule(name,salience,domain,condition,action) {
		this.name = name;
		this.salience = salience;
		this.domain = domain;
		this.range = {};
		this.condition = condition;
		this.action = action;
		this.bindings = {};
		this.crossProducts = new Map();
		this.activations = [];

		compile(this);
	} 
	Rule.prototype.bind = function(instance) {
		var me = this, variables = Object.keys(me.bindings), values = [];
		variables.forEach(function(variable,column) {
			if(instance instanceof me.domain[variable]) {
				me.bindings[variable].push(instance);
			}
			values.push(me.bindings[variable]);
		});
		// there should be a more efficient way that preserves existing crossproducts and just augments
		var cps = crossproduct(values), initialized = new Set();
		cps.forEach(function(cp) {
			var done = new Set();
			cp.forEach(function(instance) {
				if(!initialized.has(instance)) {
					me.crossProducts.set(instance,[]);
					initialized.add(instance);
				}
				if(!done.has(instance)) {
					me.crossProducts.get(instance).push(cp);
					done.add(instance);
				}
			});
		});
	};
	Rule.prototype.unbind = function(instance) {
		var me = this, values = [];
		Object.keys(me.bindings).forEach(function(variable) {
			var i = me.bindings[variable].indexOf(instance);
			if(i>=0) {
				me.bindings[variable].splice(i,1);
			}
			values.push(me.bindings[variable]);
		});
		var cps = crossproduct(values), initialized = new Set();
		cps.forEach(function(cp) {
			var done = new Set();
			cp.forEach(function(instance) {
				if(!initialized.has(instance)) {
					me.crossProducts.set(instance,[]);
					initialized.add(instance);
				}
				if(!done.has(instance)) {
					me.crossProducts.get(instance).push(cp);
					done.add(instance);
				}
			});
		});
		rule.reset(false,instance);
	}
	Rule.prototype.test = function(instance) { 
		var me = this, matches, failures, deletes, tests = me.crossProducts.get(instance);
		if(tests) {
			matches = [], failures = [];
			tests.forEach(function(test) {
				if(me.condition.apply(me,test)) {
					matches.push(test);
				} else {
					failures.push(test);
				}
			});
			if(failures.length>0) {
				deletes = [];
				me.activations.forEach(function(activation,i) {
					failures.forEach(function(failure) {
						if(failure.every(function(instance,j) { return instance===activation.bindings[j]; })) {
							deletes.push(j);
						}
					});
				});
				for(var i=deletes.length-1;i>=0;i--) {
					me.activations[i].delete();
				}
			}
			matches.forEach(function(match) {
				var activation = new Activation(me,match,RuleReactor.agenda.length,me.activations.length);
				RuleReactor.agenda.push(activation);
				me.activations.push(activation);
			});
		}
	}
	Rule.prototype.reset = function(retest,instance,key) {
		var me = this;
		if((!instance || !key || Object.keys(me.bindings).some(function(variablename) { return instance instanceof me.domain[variablename] && me.range[variablename][key]; }))) {
			for(var i=me.activations.length-1;i>=0;i--) {
				me.activations[i].delete(instance);
			}
			if(retest) {
				me.test(instance);
			}
		}
	}
	
	function Activation(rule,bindings,agendaIndex,activationIndex) {
		this.rule = rule;
		this.bindings = bindings;
		this.agendaIndex = agendaIndex;
		this.activationIndex = activationIndex;
		if(RuleReactor.tracelevel>0) {
			Console.log("Activating: ",this.rule.name,this.rule,this.bindings);
		}
	}
	Activation.prototype.execute = function() {
		if(RuleReactor.tracelevel>0) {
			Console.log("Executing: ",this.rule.name,this.rule,this.bindings);
		}
		this.delete();
		this.rule.action.apply(this.rule,this.bindings);
	}
	Activation.prototype.delete = function(instance) {
		if(!instance || this.bindings.indexOf(instance)>=0) {
			if(RuleReactor.tracelevel>0) {
				Console.log("Deactivating: ",this.rule.name,this.rule,this.bindings);
			}
			this.rule.activations.splice(this.activationIndex,1);
			RuleReactor.agenda.splice(this.agendaIndex,1);
		}
	}

	RuleReactor.rules = {};
	RuleReactor.data = new Set();
	RuleReactor.agenda = [];
	RuleReactor.trace = function() {
		RuleReactor.tracelevel = 2;
	}
	RuleReactor.insert = function() {
		var run = arguments[arguments.length-1]!==false;
		// add instance to class.constructor.instances
		var instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object" && !RuleReactor.data.has(instance)) {
				instance.constructor.instances = (instance.constructor.instances ? instance.constructor.instances : []);
				instance.constructor.instances.push(instance);
				// patch any keys on instance or those identified as active while compiling
				var keys = Object.keys(instance);
				Object.keys(instance.activeKeys).forEach(function(key) {
					if(keys.indexOf(key)===-1) {
						keys.push(key);
					}
				});
				keys.forEach(function(key) {
					function rrget() {
						return rrget.value;
					}
					function rrset(value) {
						if(rrget.value!==value) {
							// set new value
							rrget.value = value;
							// re-test the rules that pattern match the key
							Object.keys(instance.rules).forEach(function(rulename) {
								var rule = instance.rules[rulename];
								rule.reset(true,instance,key);
							});
							// if the value is an object that has possible rule matches, insert it
							if(value && value.rules) {
								setTimeout(function() { RuleReactor.insert(value,run); });
							}
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
											rule.reset(true,instance,key);
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

				// bind to all associated rules
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					rule.bind(instance);
				});
			}
		});
		// test all associated rules after everything bound
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object" && !RuleReactor.data.has(instance)) {
				RuleReactor.data.add(instance);
				Object.keys(instance.rules).forEach(function(rulename) {
					instance.rules[rulename].reset(true,instance);
				});
			}
		});
		if(run) {
			this.run();
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
			RuleReactor.remove(false);
		}
	}
	RuleReactor.remove = function() {
		var instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
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
									var args = [0,instance[key]].concat(desc.get.originalDescriptor.value)
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
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					var rule = instance.rules[ruleinstance];
					rule.unbind(instance);
				});

			}
		});
		// re-test all associated rules after everything unbound
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object") {
				Object.keys(instance.rules).forEach(function(rulename) {
					instance.rules[rulename].reset(instance);
				});
			}
		});
		if(arguments[arguments.length-1]!==false) {
			this.run();
		}
	}
	RuleReactor.run = function() {
		var agenda = RuleReactor.agenda.slice(0);
		for(var i=agenda.length-1;i>=0;i--) {
			agenda[i].execute();
		}
	}
	RuleReactor.createRule = function(name,salience,domain,condition,action) {
		var rule = new Rule(name,salience,domain,condition,action);
		RuleReactor.rules[rule.name] = rule;
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
},{}]},{},[1]);
