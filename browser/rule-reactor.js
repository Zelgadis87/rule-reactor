(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//rule-reactor

//Copyright (c) 2016 Simon Y. Blackwell, AnyWhichWay
//MIT License - http://opensource.org/licenses/mit-license.php

(function() {
	"use strict";

	// Throughout this code there are place map is used where forEach would be expected. This is because map is considerably faster
	// in some JS engines in some places even though one would expect it to be allocating memory and we ignore the return value! 

	var RuleReactor = {};

	// better on Firefox
	function crossproduct1(arrays,rowtest,rowaction) {
		var result = [],
		//indices = Array(arrays.length);
		indices = {};
		(function backtracking(index) {
			if(index === arrays.length) {
				var row = arrays.map(function(array,index) {
					return array[indices[index]];
				});
				if(!rowtest) {
					return result.push((rowaction ? rowaction(row) : row));
				} else if(rowtest(row)) {
					return result.push((rowaction ? rowaction(row) : row));
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

	// somewhat better on Chrome and far better on Edge
	function crossproduct2(arrays,rowtest,rowaction) {
		// Calculate the number of elements needed in the result
		var resultelems = 1, rowsize = arrays.length;
		for(var a=0;a<arrays.length;a++) {
			resultelems *= arrays[a].length;
		};
		var temp = {}, result = [];

		// Go through each array and add the appropriate element to each element of the temp
		var scalefactor = resultelems;
		for(var a=0;a<arrays.length;a++) {
			var array  = arrays[a];
			scalefactor /= array.length;
			for(var i=0;i<resultelems;i++) {
				temp[i] = (temp[i] ? temp[i] : []);
				var pos = i / scalefactor % array.length;
				// deal with floating point results for indexes, this took a little experimenting
				if(pos < 1 || pos % 1 <= .5) {
					pos = Math.floor(pos);
				} else {
					pos = Math.min(array.length-1,Math.ceil(pos));
				}
				temp[i].push(array[pos]);
				if(temp[i].length===rowsize) {
					var pass = (rowtest ? rowtest(temp[i]) : true);
					if(pass) {
						if(rowaction) {
							result.push(rowaction(temp[i]));
						} else {
							result.push(temp[i]);
						}
					}
					delete temp[i];
				}
			}
		}
		return result;
	}
	var crossproduct = crossproduct2;

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
		Object.keys(rule.domain).forEach(function(variable) {
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
				condition.crossproducts = [];
				var args = getFunctionArgs(condition);
				if(args.indexOf(variable)>=0) {
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
				}
			});
			var args = getFunctionArgs(rule.action);
			if(args.indexOf(variable)>=0) {
				rule.action.domain = (rule.action.domain ? rule.action.domain : {});
				rule.action.domain[variable] = true;
			}
		});
	}

	// dummy console so logging can easily be removed
	var Console = {};
	Console.log = function() { 
		console.log.apply(console,arguments); 
	};
	// uncomment line below to remove logging
	//Console.log = function() {};

	function Activation(rule,bindings) {
		this.rule = rule;
		this.bindings = bindings;
		if(RuleReactor.tracelevel>1) {
			Console.log("Activating: ",this.rule,this.bindings);
		}
	}
	Activation.prototype.execute = function() {
		if(RuleReactor.tracelevel>0) {
			Console.log("Firing: ",this.rule,this.bindings);
		}
		this.delete();
		this.rule.fire(this.bindings);
	}
	Activation.prototype.delete = function(instance) {
		if(!instance || this.bindings.indexOf(instance)>=0) {
			if(RuleReactor.tracelevel>1) {
				Console.log("Deactivating: ",this.rule,this.bindings);
			}
			this.rule.activations.delete(this);
			var i = RuleReactor.agenda.indexOf(this);
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
		this.tests = [];
		this.action = action;
		this.bindings = {};
		this.activations = new Map();
		this.signatures = {};
		this.options = {optimize:"stack"}
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
				me.bindings[variable].push(instance.__rrid__);
			}
			values.push(me.bindings[variable]);
		});
		if(test) {
			me.test(instance);
		}
	};
	Rule.prototype.fire = function(bindings) {
		var me = this, variables = Object.keys(me.domain), args = [];
		Object.keys(me.action.domain).forEach(function(actionvariable) {
			args.push(bindings[variables.indexOf(actionvariable)]);
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
		var me = this, domain = Object.keys(me.domain), crossproducts, cp = crossproduct, result = false;
		if(me.options.optimize==="heap") {
			cp = crossproduct1;
		} else if(me.options.optimize==="stack") {
			cp = crossproduct2;
		}
		if(RuleReactor.tracelevel>2) {
			Console.log("Testing: ",me,instance,key);
		}
		// get relevant variables for instance
		var instancevariables = [];
		domain.forEach(function(variable) {
			if(instance instanceof me.domain[variable]) {
				instancevariables.push(variable);
			}
		});
		instancevariables.forEach(function(instancevariable) {
			if(me.conditions.every(function(condition,i) {
				var variables = Object.keys(condition.range);
				// not all bindings available yet, so fail
				if(!variables.every(function(variable) {
					return me.bindings[variable].length>0;
				})) {
					return false;
				}
				// get values for crossproduct specific to condition
				var values = [];
				variables.some(function(variable) {
					if(!key || condition.range[variable][key]) {
						if(variable===instancevariable) {
							values.push([instance.__rrid__]);
						} else {
							values.push(me.bindings[variable]);
						}
					}
					return values.length===condition.length;
				});
				// condition is irrelevant to instance/key combination
				if(values.length<condition.length) {
					// but limit matches to those already matching the condition for other reasons
					// switch to using signature
					if(crossproducts) {
						crossproducts = condition.crossproducts.filter(function(crossProduct1) { return crossproducts.some(function(crossProduct2) { return crossProduct1row.every(function(item,i) { return item===undefined || crossProduct2[i]===item; }); }); });
						return crossproducts.length>0;
					}
					return false;
				}
				crossproducts = cp(values,
					function (row) {
						if(row.indexOf(instance.__rrid__)==-1) {
							return false;
						}
						var fullrow = new Array(domain.length);
						for(var i=0;i<row.length;i++) {
							fullrow[domain.indexOf(variables[i])] = row[i];
						}
						// create string signatures for look-up to avoid having to loop through large existing crossproducts
						// ultimately this might be used to share crossproducts across rules??
						/*var signature = "", testsignature = "";
						for(var i=0;i<domain.length;i++) {
							if(i<row.length-1) {
								//testsignature += row[i].__rrid__ + ":";
								testsignature += row[i] + ":";
							} else {
								testsignature += "?:";
							}
							//signature += (row[i] ? row[i].__rrid__ : "?") + ":";
							signature += (row[i]!==undefined ? row[i] : "?") + ":";
						}
						signature = new String(signature);*/
						var args = [];
						row.forEach(function(id) {
							args.push(RuleReactor.get(id));
						});
						// row contains instance && passes condition test && no crossproducts yet or matches a crossproduct up to the length of the crossproduct
						if(row.indexOf(instance.__rrid__)>=0 && condition.apply(me,args) && (!crossproducts || crossproducts.some(function(crossProduct) { return crossProduct.every(function(item,i) { return item===undefined || fullrow[i]===item; }); }))) {
						//if((!crossproducts || me.signatures[testsignature] || me.signatures[signature]) && condition.apply(me,args)) {
							if(RuleReactor.tracelevel>2) {
								Console.log("Join: ",me,i,row.length,args);
							}
							// have signature point to row
							//me.signatures[signature] = row;
							// save signature on row so we don't have to re-compute
							//row.signature = signature;
							// save the row on the signature so we don't have to lookup
							//signature.row = args;
							row.fullrow = fullrow;
							fullrow.row = args;
							return true;
						}
						//me.signatures[signature] = null;
					},
					function (row) {
						return row.fullrow;
						// replace the row with the signature
						//return row.signature;
					});
				if(crossproducts.length>0) {
					// cache the crossproducts matching the condition
					condition.crossproducts = crossproducts;
					return true;
				}
				return false;
			})) {
				if(crossproducts) {
					for(var i=0;i<crossproducts.length;i++) {
						// create activation and restore the crossproduct from a signature
						var activation = new Activation(me,crossproducts[i].row);
						RuleReactor.agenda.push(activation);
						me.activations.set(crossproducts[i].row,activation);
					}
					result = true;
				//if(callback) {
				//	callback(null,true);
				//} else {
				//	return true;
				//}
				}
		}});
		if(callback) {
			callback(null,result);
		} else {
			return false;
		}
	}
	/*var cbtest = Rule.prototype.test;
	Rule.prototype.test = function(instance,key,callback) {
		var me = this;
		if(callback) {
			return cbtest.call(me,instance,key,callback);
		}
		return new Promise(function(resolve,reject) {
			cbtest.call(me,instance,key,function(err,result) {
				if(!err) {
					resolve(result);
				}
				reject(err);
			})
		});
	}*/
	Rule.prototype.reset = function(retest,instance,key) {
		var me = this, activations, variables = Object.keys(me.bindings);
		if((!instance || !key || variables.some(function(variablename) { return instance instanceof me.domain[variablename] && me.range[variablename][key]; }))) {
			if(instance) {
				variables.map(function(variable) {
					if(instance instanceof me.domain[variable]) {
						var crossproducts = me.crossProducts.get(variable);
						if(crossproducts) {
							crossproducts.forEach(function(crossProduct) {
								if(crossProduct.indexOf(instance)>=0) {
									var activation = me.activations.get(crossProduct);
									if(activation) {
										activation.delete();
									}
								}
							});
						}
					}
				});
			} else {
				me.crossProducts.forEach(function(crossProducts) {
					crossProducts.forEach(function(crossProduct) {
						activations = me.activations.get(crossProduct);
						if(activations) {
							activations.forEach(function(activation) { activation.delete(); });
						}
					});
				});
			}
			if(retest) {
				me.test(instance);
			}
		}
	}
	Rule.prototype.unbind = function(instance) {
		var me = this, variables = Object.keys(me.bindings);
		variables.map(function(variable) {
			if(instance instanceof me.domain[variable]) {
				var crossproducts = me.crossProducts.get(variable);
				if(crossproducts) {
					for(var i=crossproducts.length-1;i>=0;i--) {
						if(crossproducts[i].indexOf(instance)>=0) {
							var activation = me.activations.get(crossproducts[i]);
							if(RuleReactor.tracelevel>2) {
								Console.log("Unjoin: ",me,crossproducts[i]);
							}
							crossproducts.splice(i,1);
							if(activation) {
								activation.delete();
							}
						}
					}
				}
			}
		});
		variables.map(function(variable) {
			var i = me.bindings[variable].indexOf(instance);
			if(i>=0) {
				if(RuleReactor.tracelevel>2) {
					Console.log("Unbinding: ",me,variable,instance);
				}
				me.bindings[variable].splice(i,1);
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
		instances.forEach(function(instance) {
			// don't bother processing instances that don't impact rules or are already in the data store
			if(instance && typeof(instance)==="object" && instance.__rrid__===undefined) { // !RuleReactor.data.has(instance)
				if(RuleReactor.tracelevel>2) {
					Console.log("Insert: ",instance);
				}
				Object.defineProperty(instance,"__rrid__",{value:RuleReactor.data.length});
				//RuleReactor.data.set(RuleReactor.data.size+1,instance);
				//RuleReactor.data.set(instance,instance.__rrid__);
				RuleReactor.data.push(instance)
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
							// set new value
							rrget.value = value;
							// re-test the rules that pattern match the key
							Object.keys(instance.rules).forEach(function(rulename) {
								instance.rules[rulename].test(instance,key);
							});
							// if the value is an object that has possible rule matches, insert it
							if(value && value.rules) {
								RuleReactor.insert(value);
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
											instance.rules[rulename].test(instance,key);
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
		instances.forEach(function(instance) {
			if(instance.rules) {
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					instance.rules[ruleinstance].bind(instance);
				});
			}
		});
		// test all associated rules
		//var promises = [];
		instances.forEach(function(instance) {
			if(instance.rules) {
				Object.keys(instance.rules).forEach(function(ruleinstance) {
					//promises.push(instance.rules[ruleinstance].test(instance));
					instance.rules[ruleinstance].test(instance);
				});
			}
		});
		//Promise.all(promises).then(function() {
			if(callback) {
				callback(null);
			}
		//});
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
		// re-test all associated rules after everything unbound, should we ??
		instances.forEach(function(instance) {
			if(instance && typeof(instance)==="object" && instance.rules) {
				Object.keys(instance.rules).forEach(function(rulename) {
					instance.rules[rulename].test(instance);
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
			RuleReactor.remove(false);
		}
	}
	RuleReactor.run = function(max,loose,callback) {
		function run(loose) {
			while (RuleReactor.agenda.length>0 && RuleReactor.run.executions<max) {
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
		max = (max ? max : Infinity);
		if(RuleReactor.run.running) { return true; }
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
},{}]},{},[1]);
