# rule-reactor

[![Codacy Badge](https://api.codacy.com/project/badge/grade/08aadbb230624a25a5961aeadf88b4bf)](https://www.codacy.com/app/syblackwell/rule-reactor)

[![NPM](https://nodei.co/npm/rule-reactor.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/rule-reactor/)


A light weight, fast, expressive forward chaining business rule engine leveraging JavaScript internals and Functions as objects rather than Rete. 

All rule conditions and actions are expressed as regular JavaScript functions so a JavaScript debugger can be fully utilized for debugging RuleReactor applications.

At 45K (21K minified) vs 577K (227K minified) for Nools, a comparable speed for many applications, plus a low memory impact pattern and join processor, rule-reactor is perfect for memory constrained apps like those on mobile devices.

# Install

npm install rule-reactor

The index.js and package.json files are compatible with https://github.com/anywhichway/node-require so that rule-reactor can be served directly to the browser from the node-modules/rule-reactor directory when using node Express.

Browser code can also be found in the browser directory at https://github.com/anywhichway/rule-reactor.

# Documentation

There is an intro at: http://anywhichway.github.io/rule-reactor.html

## Basic Use

For this example, we will use code from the patient.html file in the examples directory available on GitHub or via an installed npm package.

There is only one constructor most developers will need to interact with, RuleReactor.

```
var RuleReactor = require("rule-reactor");
var reactor = new RuleReactor();

```
or

```
<script src="rule-reactor.js"></script>
<script>var reactor = new RuleReactor()</script>
```

RuleReactor takes an optional boolean argument. If set to `true`, then an extra compile step is taken when creating rules. This can boost performance by up to 25%; however, breakpoints set in rule conditions, will no longer work. So, this should be a final step in development.

The first thing to do is decide which of your own classes are going to be accessed by rules and ensure they are defined before any referencing rules are created.

```
function Patient() { }
```

No properties have to be defined on the class. If they are referenced by a rule but missing, they will be added automatically.

Now define rules. Below are two examples.

```
reactor.createRule("Measles",0,{p: Patient},
	function(p) {
		return p.fever=="high" && p.spots==true && p.innoculated==false;
	},
	function(p) {
		p1.diagnosis = new Diagnosis("measles","High temp, spots, and no innoculation for measles.");
	});
	
reactor.createRule("Penicillin",0,{p: Patient, d: Diagnosis},
	function(d) {
		return d.name=="measles";
	},
	function(p) {
		p.treatment = new Treatment("penicillin");
	});
```

As a result of the above rules, instances of Patient will automatically have the properties fever, spots, innoculated, diagnosis, and treatment added.

* Rules start with a name, which is followed by a salience, a.k.a. priority. This is used to decide which rule to execute first if more than one rule has its conditions satisfied. The higher the salience, the higher the priority. Values can run from -Infinity to Infinity.
* After this comes the domain specification, which consists of an object the properties of which are the names for class referencing variables that will be used by rule conditions and actions. The values of these properties are the constructors for the classes. 
* After the domain comes a condition or array of conditions. These are functions that return true or false. They
should not produce any side effects because they will be called a lot and strange things might happen as a result. Note, it is generally better to use == rather than === in rules because this allows objects to resolve using their valueOf() function. 
* Finally, an action is specified. This can be a function that executes any normal JavaScript code. If an assignment of an object to a property on an object that already exists in the RuleReactor memory is made, the object will be automatically inserted. 
* You can also create objects and insert them, using `reactor.insert(object)`. Or, you can create objects that do not end-up in RuleReactor memory, by just creating them and not inserting them or assigning them to anything.

After the rules have been defined, an initial set of facts against which the rules will execute is normally created.

```
var p = new Patient();
p.fever = "high";
p.spots = true;
p.innoculated = false;
reactor.insert(p);
```

All that is left to do is run the RuleReactor.

```
reactor.trace(0);
reactor.run(Infinity,true,function() { 
	console.log(JSON.stringify(p)); 
});
```
The first argument to run is the number of rules to execute before stopping. Unless debugging is being conducted, this is typically set to Infinity. Note, we could put print statements in the rule actions, but above we chose to provide a callback that will be invoked when there are no more rules to process. The above will print:

```
{"diagnosis":{"name":"measles","reason":"High temp, spots, and no innoculation for measles."},"treatment":{"name":"penicillin"},"fever":"high","spots":true,"innoculated":false,"soreThroat":false}
```

The second argument tells the RuleReactor to run just one rule every time slice to allow the JavaScript engine to handle other requests. By default, this is false since it can have a substantial impact on RuleReactor performance. However, if you have a set of rules that take more than a second to process in production, you should set it to true.

If you start a RuleReactor with Infinity, then to stop running, you need to call stop. A simple way to do this is to have a low salience rule with no conditions, e.g.

```
reactor.createRule("stop",-100,{},
	function() {
		return true;
	},
	function() {
		reactor.stop();
	});
```

## Advanced Use

### Primitives

You can write rules that reference JavaScript primitives as part of the domain by using their Object equivalents, e.g. `{num: Number}`. See the send-more-money.html file in the test directory for an example.

### Convenience Declarations

To make your rules easier to read, you may wish to put these lines at the top of your rule files:

```
function assert() { return reactor.assert.apply(reactor,arguments); }
function not() { return reactor.not.apply(reactor,arguments); }
function exists() { return reactor.exists.apply(reactor,arguments); }
function forAll() { return reactor.forAll.apply(reactor,arguments); }
```

### Existential Quantification

Rules can check to see if a condition is true at least once across all possible combinations of a domain and fire just once rather than for each possible combination, e.g.

```
reactor.createRule("homeless",0,{},
	function() {
		return reactor.exists({person: Person},function(person) { return person.home==null; });
	},
	function() {
		console.log("There are homeless people.");
	});
```
Note that existential quantification required its own domain specification. Also note that the rule above is domainless.


We could also write a rule to ensure there are no homeless people:

```
function not() { return reactor.not.apply(reactor,arguments); }
function exists() { return reactor.exists.apply(reactor,arguments); }

reactor.createRule("exists1",0,{person: Person},
	function(person) {
		return not(exists({home: Home},function(home) { return home.owner === person; }));
	},
	function(person) {
		person.home = new Home(person);
	});
```

This rule is read as follows, "If there is a Person and it is not the case a home exists where that person is the owner, then create a new home."

Note that the domain variable `person` cab be referenced inside the existential test as a result of using JavaScript's closure capability. Also note that existential quantification can be wrapped in `not` and we made the rule easier to read through the use of convenience function definitions beforehand.

### Existential Quantification With Indexed Patterns

If you are conducting existential quantification over a potentially large volume of instances, you may wish to use a pattern rather than a function. RuleReactor indexes all properties on all objects that are asserted. The index is attached to the constructor for the instance and can be matched against using a JSON pattern. The below two tests drawn from the exists-and-forAll example are semantically identical:

```
// this rule matches against an index
reactor.createRule("exists2",0,{h: Home},
	function(h) {
		return exists({p: Person},{p: {home: h}});
	},
	function(h) {
		console.log(h," is assigned to a person.");
	});
```

```
// this rule loops across all Person's
reactor.createRule("exists2",0,{h: Home},
	function(h) {
		return exists({p: Person},function(p) { return p.home==h; });
	},
	function(h) {
		console.log(h," is assigned to a person.");
	});
```

It is possible to pattern match across multiple class types. The below would test to see if there is a Person without a home and a Home without and owner.

```
exists({p: Person,h: Home},{p: {home: null},h: {owner: null}});
```


### Universal Quantification

Universal quantification works the same way as existential quantification except it checks if a condition is always true across all possible combinations of a domain, e.g.

```
reactor.createRule("every",0,{},
	function() {
		return forAll({person: Person},function(person) { return person.home!==undefined; });
	},
	function() {
		console.log("Everyone universally has a home!");
	});
```

### Triggerless Rules

If you want to have a rule that is evaluated every rule processing cycle, then just make the rule have no domain and no existential or universal quantification, e.g.

```
reactor.createRule("execute after changes",0,{},
	function() {
		// perhaps poll some external data here
		return true;
	},
	function() {
		// do something;
	});
```


## Debugging and Testing

Just above the run command a few lines up, you can see a call to .trace. RuleReactor has 3 trace levels that print to the JavaScript console. A value of 0 turns tracing off.

1. Prints when:
	* RuleReactor is starting to run.
	* A specific rule is firing
2. Prints when:
	* A rule is being activated when all it conditions have been met
	* A rule is being de-activated when its conditions are no longer being met or immediately after executing its action
3. Prints when:
	* A new rule is being created
	* New data is being inserted into RuleReactor
	* Data is being bound or unbound from rule. This immediately follows insert for all impacted rules.
	* An object with an impact on a rule is being modified. 
	* A rule is being tested. This happens when at least one of every object in the domain for the rule is bound. It will repeat if a relevant property is changed on a bound object.
	* An object is being removed from the RuleReactor.
	
But, most importantly you can set regular JavaScript break points in your rule conditions! If you have a complex condition, then break it into several functions while doing development.

To assist in unit testing rules, RuleReactor keeps track of the maximum number of potential matches found for a rule as well as how many times it was tested, activated, or fired. These statistics are printed to the console in the order just listed when the .run command completes if the trace level is set to 3. They are also available as data properties of a rule instance.


# Performance & Size

Preliminary tests show performance close to that of Nools. However, the rule-reactor core is just 41K (19K minified) vs 577K (227K minified) for Nools. At runtime, rule-reactor will also consume many megabytes less memory than nools for its pattern and join processing.


# Building & Testing

Building, testing and quality assessment are conducted using Travis, Mocha, Chai, Istanbul, Code Climate, and Codacity.

For code quality assessment purposes, the cyclomatic complexity threshold is set to 10.

# Notes


# Updates (reverse chronological order)

Currently BETA

2016-04-21 v0.0.22 Not published to npm.

* Added unit tests.
* Renamed function forall for constructor instance checking to forAll. This does not impact the forAll that is used in rules.
* Modified bind to return true/false if it is used to test rules by passing the optional test argument.
* Started building through travis-ci online.

2016-04-21 v0.0.21 

* Added Codacy and NPM badges.

2016-04-21 v0.0.20 Not published to npm.

* Codacy and CodeClimate driven style quality improvements. 

2016-04-21 v0.0.19  Not published to npm.

* Codacy and CodeClimate driven style quality improvements.

2016-04-21 v0.0.18 Not published to npm.

* Codacy and CodeClimate driven style quality improvements. 

2016-04-21 v0.0.17 Not published to npm.

* Corrected some documentation errors
* Codacy and CodeClimate driven style quality improvements. 

2016-04-20 v0.0.16 

* Performance optimizations
* Removal of unused code

2016-04-11	 v0.0.15

* Fixed issue where binding test was looking for instance id rather than instance. Could have resulted in duplicate instances in bindings.
* Documented existential pattern matching.
* Added Miss Manners example.
* exists-and-every.html example renamed to exists-and-forAll.html.
* Improved performance by approximately 25% by adding a rule condition compilation functionality. This can be turned on using an optional boolean argument when instantiating a RuleReactor.
* when run is called with Infinity, stop() must now be explicitly called to stop running.

2016-04-06	 v0.0.14 

* Changed .insert and .remove to .assert and .retract to be consistent with many other rule engines.
* RuleReactor is no longer a singleton, an instance must be created with new RuleReactor(). This effectively provides support for multiple rule sets. 
* Not only have unit tests been added, the RuleReactor itself has had testing capability
added. See documentation section on Debugging and Testing. 
* Modified the internal storage of data from an Array to a Map.
* Added dependency on uuid package for generating internal object ids.
* Added support for JavaScript primitive objects as part of rule domains, e.g. {num: Number}. 
* Added rule validity checking, e.g. ensuring domains variables referenced by conditions are declared for the rule.
* Added existential and universal quantification.
* Corrected issue where rule activations were not being tracked properly when not created as a result of a specific instance.
* Corrected issue where properties only referenced in rule actions were not being made reactive. This prevented proper existential and universal quantification behavior.
* Enhanced documentation

2016-03-31 v0.0.13 No functional changes.

2016-03-31 v0.0.12 No functional changes.

2016-03-31 v0.0.11 Added documentation. Corrected nools performance statements (it is faster than was stated).

2016-03-31 v0.0.10 Salience ordering is now working. Re-worked the cross-product and matching for a 10x performance increase in Firefox and Chrome. Send More Money can now be solved in 2 minutes similar to nools. License changed to GPL 3.0.

2016-03-22 v0.0.9 Improved rule matching further by packing all arrays with -1 in place of undefined. Ensures JavaScript engine does not convert a sparse array into a map internally. Corrected documentation regarding permutations explored for Send More Money.

2016-03-21 v0.0.8 Added Send More Money example for stress testing joins. Further optimized cross-product to reduce heap use. Optimized call of cross-product
in rule processing to reduce possible size of cross-product based on the rule being tested. The net performance improvements have been 5x to 10x, depending on the
nature of the rules and the amount of data being processed.

2016-03-20 v0.0.7 Unpublished code style changes. No functional changes.

2016-03-20 v0.0.6 Rule condition processing optimizations for both speed and memory. Added ability to provide a list of functions as a rule condition to reduce cross-product join load. Enhanced rule condition and action parsing so that only the variable for the relevant object domain needs to be provided. This provides a "hint" to RuleReactor to reduce the number
of objects included in a cross-product. Provided a run option to loosen up the run loop and added the ability to have a callback when complete. In v0.0.0.7 or 8 a Promise implementation will be provided. Loosening up the run loop slows performance, so it is optional. Added a .setOptions function to Rules to choose the cross-product approach for optimizing stack or heap size.
Typically optimizing the stack increases performance (although it may vary across browsers), so it is the default. Heap optimization is required for rules that have very large join possibility. Fixed an issue where sometimes the last rule on the agenda would not fire.

2016-03-17 v0.0.5 Further optimization of cross-product.

2016-03-16 v0.0.4 Further optimization.

2016-03-16 v0.0.3 Unpublished. Reworked cross-product so that it is non-recursive so that more joins can be supported.

2016-03-13 v0.0.2 Performance improvements

2016-03-10 v0.0.1 Original public commit

# License

This software is provided as-is under the [AGPL 3.0 license](https://opensource.org/licenses/AGPL-3.0).