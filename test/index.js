var expect, RuleReactor;
if(typeof(window)==="undefined") {
	expect = require("chai").expect;
	RuleReactor = require('../index.js');
}

describe('reactor ', function() {
	it('should support normal matching',function() {
		function  TestObject(value) {
			this.value = value;
		};
		var reactor = new RuleReactor();
		var to = new TestObject("test");
		var rule = reactor.createRule("test",0,{t: TestObject},
				function(t) {
					return t.value == "test";
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
	it('should support primtive object matching',function() {
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
	it('should support existential tests',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return reactor.exists({to: Number},function(to) { return to==1; });
				},
				function() {
					;
				}
		);
		var result = rule.test();		
		expect(result).to.equal(true);
		rule.delete();
	});
	it('should support universal tests',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return reactor.forAll({to: Number},function(to) { return to==1; });
				},
				function() {
					;
				}
		);
		var result = rule.test();		
		expect(result).to.equal(true);
		rule.delete();
	});
	it('should support negation tests',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		reactor.assert(to);
		var rule = reactor.createRule("test",0,{},
				function() {
					return reactor.not(reactor.forAll({to: Number},function(to) { return to==2; }));
				},
				function() {
					;
				}
		);
		var result = rule.test();		
		expect(result).to.equal(true);
		rule.delete();
	});
	it('should support array of conditions',function() {
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
	it('should order by salience',function() {
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
	it('should support rule reset',function() {
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
	it('should throw TypeError when condition does not contain return',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
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
	it('should throw TypeError when every does not contain return',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
					function() {
						every({t1: Number}, function(t1) { t1==1; });
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
	it('should throw TypeError when exists does not contain return',function() {
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
	it('should throw ReferenceError when undeclared variable encountered in condition',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",1,{},
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
		expect(result).to.be.instanceof(ReferenceError);
		if(rule) {
			rule.delete();
		}
	});
	it('should throw ReferenceError when undeclared variable encountered in action',function() {
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
	it('should throw TypeError when domain is not a function',function() {
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
	it('should throw TypeError when salience is not a number',function() {
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
	it('should throw TypeError when domain is not an object',function() {
		var reactor = new RuleReactor();
		var to = new Number(1);
		var result, rule;
		try {
			rule = reactor.createRule("rule",0,null,
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
	it('should throw TypeError when action is not a function',function() {
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
});
