#!/usr/bin/env node

var er = require('../'),
    runner = require('../lib/runner'),
    args = process.argv,
    workDir = process.cwd();

var defaultTask = args[0];

console.log('Choosen target: ' + defaultTask);

runner.invoke(defaultTask, function(err, success) {
  if (err) return console.log('Task finished with errors');
  console.log('Task finished succesfully');
});
