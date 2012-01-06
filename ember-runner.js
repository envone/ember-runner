var exec = require('child_process').exec,
    runner = require('./lib/runner'),
    args = process.argv,
    workDir = process.cwd();
    
// Clean args.
args.shift(); // node
args.shift(); // ember-runtime

runner.task('default', 'Run preview server', ['task:clean', 'apps', 'vendors'], function(callback) {
  callback(null, true);
});

runner.task('apps', 'Run preview server', ['task:configure'], function(callback) {
  callback(null, true);
});

runner.task('vendors', 'Run preview server', ['task:configure'], function(callback) {
  callback(null, true);
});

// ================
// = GENERIC TASK =
// ================

runner.task('task:clean', 'Clean all generated directories', function(callback) {
  callback(null, true);
});

runner.task('task:configure', 'Retrieve configuration parameters', function(callback) {
  callback(null, true);
});

defaultTask = args[0];

runner.invoke(defaultTask, function(err, success) {
  if (err) return console.log('Task finished with errors');
  console.log('Task finished succesfully');
});