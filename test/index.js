var expect, RuleReactor;
if(typeof(window)==="undefined") {
	expect = require("chai").expect;
	RuleReactor = require("../index.js");
}

describe("rule-reactor ", function() {
	it("should support normal matching",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		var result = rule.test(to);
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support reacting to object changes matching",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject(null);
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		var result = rule.test(to);
		expect(result).to.equal(false);
		to.value = "test";
		result = rule.test(to);
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support unbinding data from rules",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		rule.unbind(to);
		var result = rule.test(to);
		expect(result).to.equal(false);
		rule.delete();
	});
	it("rule test should fail if not all conditions bound",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		var result = rule.test(to);
		expect(result).to.equal(false);
		rule.delete();
	});
	it("should support directly firing rule",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		rule.test(to);
		rule.fire();
		expect(rule.fired).to.equal(1);
		expect(reactor.run.executions).to.equal(1);
		rule.delete();
	});
	it("should support boosting",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor({},true);
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		var result = rule.test(to);
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support activating and executing rules",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		rule.test(to);
		var activations = rule.activations.get(to);
		expect(activations).to.be.instanceof(Array);
		expect(activations[0]).to.be.instanceof(Object);
		activations[0].execute();
		rule.delete();
	});
	it("should support deleting activations by instance",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		rule.test(to);
		var activations = rule.activations.get(to);
		expect(activations).to.be.instanceof(Array);
		expect(activations[0]).to.be.instanceof(Object);
		activations[0].delete(to);
		rule.delete();
	});
	it("should support deleting activations generally",function() {
		function  TestObject(value) {
			this.value = value;
		}
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
				},
				function() {
					
				}
		);
		rule.bind(to);
		rule.test(to);
		var activations = rule.activations.get(to);
		expect(activations).to.be.instanceof(Array);
		expect(activations[0]).to.be.instanceof(Object);
		activations[0].delete();
		rule.delete();
	});
	it("should support primtive object matching",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var rule = reactor.createRule("test",0,{t: Number},
				function(t) {
					return t == 1;
				},
				function(t) {
					;
				}
		);
		rule.bind(to);
		var result = rule.test(to);
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support testing right after bind",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var rule = reactor.createRule("test",0,{t: Number},
				function(t) {
					return t == 1;
				},
				function(t) {
					;
				}
		);
		var result = rule.bind(to,true);
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support existential tests",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return RuleReactor.exists({to: Number},function(to) { return to==1; });
				},
				function() {
					;
				}
		);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support existential pattern tests",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return RuleReactor.exists({to: Number},{to: 1});
				},
				function() {
					;
				}
		);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support universal tests",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return RuleReactor.forAll({to: Number},function(to) { return to==1; });
				},
				function() {
					;
				}
		);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support universal pattern tests",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return RuleReactor.forAll({to: Number},{to: 1});
				},
				function() {
					;
				}
		);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support negation tests",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return RuleReactor.not(RuleReactor.forAll({to: Number},function(to) { return to==2; }));
				},
				function() {
					;
				}
		);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should support array of conditions",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{t1:Number, t2:Number},
				[
				function(t1) {
					return t1==1;
					},
				function(t2) {
					return t2==1;
					}
				],
				function() {
					;
				}
		);
		rule.bind(to);
		var result = rule.test();
		expect(result).to.equal(true);
		rule.delete();
	});
	it("should order by salience",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var rule1 = reactor.createRule("rule one",1,{t1:Number},
				function(t1) {
					return t1==1;
				},
				function() {
					;
				}
		);
		var rule2 = reactor.createRule("rule two",0,{t1:Number},
				function(t1) {
					return t1==1;
				},
				function() {
					;
				}
		);
		reactor.assert(to);		
		expect(reactor.agenda[1].rule).to.equal(rule1);
		rule1.delete();
		rule2.delete();
	});
	it("should support rule reset",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var rule = reactor.createRule("rule",1,{t1:Number},
				function(t1) {
					return t1==1;
				},
				function() {
					;
				}
		);
		reactor.assert(to);		
		expect(reactor.agenda[0].rule).to.equal(rule);
		rule.reset();
		expect(reactor.agenda.length).to.equal(0);
		rule.delete();
	});
	it("should throw TypeError domain not an object",function() {
		var reactor = new RuleReactor();
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,null,
					function(t1) {
						t1==1;
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when condition does not contain return",function() {
		var reactor = new RuleReactor();
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{t1:Number},
					function(t1) {
						t1==1;
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when forAll does not contain return",function() {
		var reactor = new RuleReactor();
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
					function() {
						forAll({t1: Number}, function(t1) { t1==1; });
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when forAll domain is not an object",function() {
		var reactor = new RuleReactor();
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
					function() {
						forAll(null, function(t1) { t1==1; });
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when exists does not contain return",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
					function() {
						exists({t1: Number}, function(t1) { t1==1; });
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw ReferenceError when undeclared variable encountered in condition",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
					function(t1) {
						return t1==1;
					},
					function() {
						
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(ReferenceError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw ReferenceError when undeclared variable encountered in action",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{t1: Number},
					function(t1) {
						return t1==1
					},
					function(t2) {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(ReferenceError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when domain is not a function",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{t1: null},
					function(t1) {
						return t1==1
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when salience is not a number",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",null,{t1: Number},
					function(t1) {
						return t1==1
					},
					function() {
						;
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when domain is not an object",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",0,null,
					function(t1) {
						return t1==1;
					},
					function() {
						
					}
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should throw TypeError when action is not a function",function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",0,{t1: Number},
					function(t1) {
						return t1==1
					},
					null
			);
		} catch(e) {
			result = e;
		}	
		expect(result).to.be.instanceof(TypeError);
		if(rule) {
			rule.delete();
		}
	});
	it("should support exists on constructor instances as well as in rules", function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result;
		reactor.assert(to);
		result = Number.exists(function(instance) { return instance.valueOf()===1; })
		expect(result).to.equal(true);
	});
	it("should support exists on constructor instances with no test, i.e. there is at least one", function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result;
		reactor.assert(to);
		result = Number.exists()
		expect(result).to.equal(true);
	});
	it("should support not exists on constructor instances with no test, i.e. there are none", function() {
		var reactor = new RuleReactor();
		var result;
		result = Number.exists()
		expect(result).to.equal(true);
	});
	it("should support not exists on constructor instances as well as in rules", function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result;
		reactor.assert(to);
		result = Number.exists(function(instance) { return instance.valueOf()===2; })
		expect(result).to.equal(false);
	});
	it("should support forAll on constructor instances as well as in rules", function() {
		delete Number.instances;
		var reactor = new RuleReactor();
		var to1 = new Number(1), to2 = new Number(1);
		var result;
		reactor.assert(to1);
		reactor.assert(to2);
		result = Number.forAll(function(instance) { return instance.valueOf()===1; })
		expect(result).to.equal(true);
	});
	it("should support not forAll on constructor instances as well as in rules", function() {
		delete Number.instances;
		var reactor = new RuleReactor();
		var to1 = new Number(1), to2 = new Number(2);
		var result;
		reactor.assert(to1);
		reactor.assert(to2);
		result = Number.forAll(function(instance) { return instance.valueOf()===1; })
		expect(result).to.equal(false);
	});
	it("should support tracing", function() {
		delete Number.instances;
		var reactor = new RuleReactor();
		reactor.trace(3);
		var to1 = new Number(1), to2 = new Number(2);
		var result;
		reactor.assert(to1);
		reactor.assert(to2);
		result = Number.forAll(function(instance) { return instance.valueOf()===1; })
		expect(result).to.equal(false);
	});
});
