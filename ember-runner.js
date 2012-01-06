// Frameworks vars
var fs = require('fs'),
    async = require('async'),
    runner = require('./lib/runner'),
    helpers = require('./lib/helpers'),    
    args = process.argv,
    workDir = process.cwd();
    
// Configuration vars
var buildInfo, workFiles;

// Clean args.
args.shift(); // node
args.shift(); // ember-runtime

runner.task('default', 'Run preview server', ['preview'], function(callback) {
  callback(null, true);
});

runner.task('preview', 'Run preview server', ['build'], function(callback) {
  runner.runServer(buildInfo.server, function(err, success) {
    callback(null, true);    
  });
});

runner.task('build', 'Build libraries and applications', ['apps', 'vendors'], function(callback) {
  callback(null, true);
});

runner.task('apps', 'Generate applications libraries', ['task:configure'], function(callback) {
  callback(null, true);
});

runner.task('vendors', 'Generate vendors libraries', ['task:configure'], function(callback) {
  callback(null, true);
});

// ================
// = GENERIC TASK =
// ================

runner.task('task:clean', 'Clean all generated directories', function(callback) {
  callback(null, true);
});

runner.task('task:configure', 'Retrieve configuration parameters', function(callback) {
  var self = this;
  
  fs.readFile([__dirname, 'ember_runner_config.json'].join('/'), function(err, file) {
    if (err) return callback("Error no build.json file found");
    
    buildInfo = JSON.parse(file);
    
    // Generate generics attributes
    buildInfo.srcApps = [workDir, buildInfo.apps.input].join('/');
    buildInfo.srcVendors = [workDir, buildInfo.vendors.input].join('/');
    buildInfo.tmpApps = [workDir, buildInfo.tmpDir, buildInfo.apps.input].join('/');
    buildInfo.tmpVendors = [workDir, buildInfo.tmpDir, buildInfo.vendors.input].join('/');
    buildInfo.tgtApps = [workDir, buildInfo.apps.output].join('/');
    buildInfo.tgtVendors = [workDir, buildInfo.vendors.output].join('/');
                
    callback(null, true);
  });
});

runner.task('task:walk', 'Check for all files to be used', function(callback) {
  
  async.parallel([
    // Load apps files
    function(callback) {
      helpers.walk(buildInfo.srcApps, function(err, results) {
        if (err) return callback("Error walking files.");    
        callback(null, results);
      });
    },
    // Load vendors files
    function(callback) {
      helpers.walk(buildInfo.srcVendors, function(err, results) {
        if (err) return callback("Error walking files.");    
        callback(null, results);
      });
    }
  ], function(err, results) {
    workFiles = {
      dirs: results[0].dirs.concat(results[1].dirs),
      files: results[0].files.concat(results[1].files)
    };

    callback(null, true);
  });
  
});

var defaultTask = args[0];

runner.invoke(defaultTask, function(err, success) {
  if (err) return console.log('Task finished with errors');
  console.log('Task finished succesfully');
});