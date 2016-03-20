# rule-reactor

A light weight, fast, expressive forward chaining business rule engine leveraging JavaScript internals and Functions as objects rather than Rete.

# Install

npm install rule-reactor

The index.js and package.json files are compatible with https://github.com/anywhichway/node-require so that rule-reactor can be served directly to the browser from the node-modules/jovial directory when using node Express.

Browser code can also be found in the browser directory at https://github.com/anywhichway/rule-reactor.

# Documentation

Documentation will be available about 2016-03-30. Meanwhile see examples and test directories. 

There is also an intro at: http://anywhichway.github.io/rule-reactor.html

# Building & Testing

Building & testing is conducted using Travis, Mocha, Chai, and Istanbul.

For code quality assessment purposes, the cyclomatic complexity threshold is set to 10.

# Notes

v0.0.6 Salience ordering is not working for the agenda.


# Updates (reverse chronological order)

Currently ALPHA

2016-03-20 v0.0.6 Rule condition processing optimizations for both speed and memory. Added ability to provide a list of functions as a rule condition to reduce cross-product join load. Enhanced rule condition and action parsing so that only the variable for the relevant object domain needs to be provided. This provides a "hint" to RuleReactor to reduce the number
of objects included in a cross-product. Provided a run option to loosen up the run loop and added the ability to have a callback when complete. In v0.0.0.7 or 8 a Promise implementation will be provided. Loosening up the run loop slows performance, so it is optional. Added a .setOptions function to Rules to choose the cross-product approach for optimizing stack or heap size.
Typically optimizing the stack increases performance (although it may vary across browsers), so it is the default. Heap optimization is required for rules that have very large join possibility.Fixed an issue where sometimes the last rule on the agenda would not fire.

2016-03-17 v0.0.5 Further optimization of crossproduct.

2016-03-16 v0.0.4 Further optimization.

2016-03-16 v0.0.3 Unpublished. Reworked crossproduct so that it is non-recursive so that more joins can be supported.

2016-03-13 v0.0.2 Performance improvements

2016-03-10 v0.0.1 Original public commit

# License

This software is provided as-is under the [MIT license](http://opensource.org/licenses/MIT).