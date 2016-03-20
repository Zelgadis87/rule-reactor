//rule-reactor

//Copyright (c) 2016 Simon Y. Blackwell, AnyWhichWay
//MIT License - http://opensource.org/licenses/mit-license.php
(function() {
	"use strict";
	
	// Throughout this code there are place map is used where forEach would be expected. This is because map is considerably faster
	// in some JS engines in some places even though one would expect it to be allocating memory and we ignore the return value! 

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
					items[index] = value;
					match[index] = bit;
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

	// better on Firefox
	function crossproduct1(arrays,rowtest,rowaction) {
		var result = [],
		indices = Array(arrays.length);
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
		  var result_elems = 1, row_size = arrays.length;
		  arrays.map(function(array) {
				result_elems *= array.length;
		  });
		  var temp = new Array(result_elems), result = [];
		
		  // Go through each array and add the appropriate element to each element of the temp
		  var scale_factor = result_elems;
		  arrays.map(function(array)
		  {
		    var set_elems = array.length;
		    scale_factor /= set_elems;
		    for(var i=result_elems-1;i>=0;i--) {
		    	temp[i] = (temp[i] ? temp[i] : []);
		    	var pos = i / scale_factor % set_elems;
		    	// deal with floating point results for indexes, this took a little experimenting
		    	if(pos < 1 || pos % 1 <= .5) {
		    		pos = Math.floor(pos);
		    	} else {
		    		pos = Math.min(array.length-1,Math.ceil(pos));
		    	}
		    	temp[i].push(array[pos]);
		    	if(temp[i].length===row_size) {
		    		var pass = (rowtest ? rowtest(temp[i]) : true);
		    		if(pass) {
		    			if(rowaction) {
		    				result.push(rowaction(temp[i]));
		    			} else {
		    				result.push(temp[i]);
		    			}
		    		}
		    	}
		    }
		  });
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
		})
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
		this.crossProducts = new Map();
		this.options = {optimize:"stack"};
		compile(this);
	} 
	Rule.prototype.bind = function(instance) {
		var me = this, variables = Object.keys(me.bindings), values = [];
		variables.map(function(variable) {
			if(instance instanceof me.domain[variable] && me.bindings[variable].indexOf(instance)===-1) {
				if(RuleReactor.tracelevel>2) {
					Console.log("Binding: ",me,variable,instance);
				}
				me.bindings[variable].push(instance);
			}
			values.push(me.bindings[variable]);
		});
		/*if(variables.every(function(variable) {
			return me.bindings[variable].length>0;
		})) {
			var crossproducts = crossproduct(values,
					function(row) { 
						if(row.indexOf(instance)>=0) {
							if(RuleReactor.tracelevel>2) {
								Console.log("Join: ",me,row.length,row);
							}
							return true;
						}; 
					},
					function(row) {
						row.forEach(function(instance,column) {
							var variable = variables[column];
							var crossproducts = me.crossProducts.get(variable);
							if(!crossproducts) {
								crossproducts = [];
								me.crossProducts.set(variable,crossproducts);
							}
							crossproducts.push(row);
						});
						return row;
					}
			);
			if(crossproducts) {
				if(RuleReactor.tracelevel>1) {
					Console.log("Join Count: ",me,crossproducts.length);
				}
				me.test(instance);
			}
		}*/
		me.test(instance);
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
	Rule.prototype.test = function(instance,key) { 
		var me = this, crossproducts, matches = [instance], cp = crossproduct2;
		if(me.options.optimize==="heap") {
			cp = crossproduct1;
		} else if(me.options.optimize==="stack") {
			cp = crossproduct2;
		}
		if(me.conditions.every(function(condition,i) {
			var variables = Object.keys(condition.range);
			// get values for crossproduct specific to condition
			var values = [];
			variables.some(function(variable) {
				if(!key || condition.range[variable][key]) {
					values.push(me.bindings[variable]);
				}
				return values.length===condition.length;
			});
			// condition is irrelevant to instance/key combination
			if(values.length<condition.length) {
				// but limit matches to those already matching the condition for other reasons
				if(crossproducts) {
					crossproducts = condition.crossproducts.filter(function(crossProduct1) { return crossproducts.some(function(crossProduct2) { return crossProduct1.every(function(item,i) { return crossProduct2[i]===item; })}) });
					return crossproducts.length>0;
				}
				return false;
			}
			// not all bindings available yet, so fail
			if(!variables.every(function(variable) {
				return me.bindings[variable].length>0;
			})) {
				return false;
			}
			crossproducts = cp(values,
					function(row) {
						// row contains instance && passes condition test && no crossproducts yet or matches a crossproduct up to the length of the crossproduct
						if(row.indexOf(instance)>=0 && condition.apply(me,row) && (!crossproducts || crossproducts.some(function(crossProduct) { return crossProduct.every(function(item,i) { return row[i]===item; }) }))) {
							if(RuleReactor.tracelevel>2) {
								Console.log("Join: ",me,i,row.length,row);
							}
							return true;
						}
					});
			if(crossproducts.length>0) {
				// cache the crossproducts matching the condition
				condition.crossproducts = crossproducts;
				return true;
			}
			return false;
		})) {
			if(crossproducts) {
				crossproducts.forEach(function(crossProduct) {
					var activation = new Activation(me,crossProduct);
					RuleReactor.agenda.push(activation);
					me.activations.set(crossProduct,activation);
				});
			}
			return true;
		}
		/*var me = this, activations = [], tests = new Set(), variables = Object.keys(me.bindings);
		if(!instance || !key || variables.some(function(variable) { return instance instanceof me.domain[variable] && me.range[variable][key]; })) {
			if(instance) {
				variables.map(function(variable) {
					if(instance instanceof me.domain[variable] && (!key || me.range[variable][key])) {
						var crossproducts = me.crossProducts.get(variable);
						if(crossproducts) {
							var crossproductstotest = [];
							crossproducts.forEach(function(crossProduct) {
								if(crossProduct.indexOf(instance)>=0) {
									crossproductstotest.push(crossProduct);
									var activation = me.activations.get(crossProduct);
									if(activation) {
										activation.delete();
									}
								}
							});
							if(crossproductstotest.length>0) {
								tests.add(crossproductstotest);
							}
						}
					}
				});
			} else {
				me.crossProducts.forEach(function(crossProducts,variable) {
					tests.set(variable,crossProducts);
					crossProducts.forEach(function(crossProduct) {
						var activation = me.activations.get(crossProduct);
						if(activation) {
							activation.delete();
						}
					});
				});
			}
			tests.forEach(function(crossProducts) {
				crossProducts.forEach(function(crossProduct) {
					if(me.conditions.every(function(condition) {
						return condition.apply(me,crossProduct);
					})) {
						var activation = new Activation(me,crossProduct);
						RuleReactor.agenda.push(activation);
						me.activations.set(crossProduct,activation);
					}
				});
			});
		}*/
		
	}
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
	RuleReactor.data = new Set();
	RuleReactor.agenda = [];
	RuleReactor.createRule = function(name,salience,domain,condition,action) {
		var rule = new Rule(name,salience,domain,condition,action);
		RuleReactor.rules[rule.name] = rule;
		return rule;
	}
	RuleReactor.insert = function() {
		var run = (arguments[arguments.length-1] instanceof Object ? false : arguments[arguments.length-1]);
		// add instance to class.constructor.instances
		var instances = [].slice.call(arguments);
		instances.forEach(function(instance) {
			// don't bother processing instances that don't impact rules or are already in the data store
			if(instance && typeof(instance)==="object" && !RuleReactor.data.has(instance)) {
				if(RuleReactor.tracelevel>2) {
					Console.log("Insert: ",instance);
				}
				RuleReactor.data.add(instance);
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
								RuleReactor.insert(value,run);
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

				// bind to all associated rules
				if(instance.rules) {
					Object.keys(instance.rules).forEach(function(ruleinstance) {
						instance.rules[ruleinstance].bind(instance);
					});
				}
			}
		});
		// test all associated rules after everything bound
//		instances.forEach(function(instance) {
//			if(instance && typeof(instance)==="object" && !RuleReactor.data.has(instance)) {
//				RuleReactor.data.add(instance);
//				if(instance.rules) {
//					Object.keys(instance.rules).forEach(function(rulename) {
//						instance.rules[rulename].test(instance);
//					});
//				}
//			}
//		});
		if(run) {
			setTimeout(function() { RuleReactor.run(); });
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
					setTimeout(function() { run(loose); });
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