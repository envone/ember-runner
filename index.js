// Frameworks vars
var fs = require('fs'),
    async = require('async'),
    runner = require('./lib/runner'),
    helpers = require('./lib/helpers'),
    pm = require('./lib/packages'),
    args = process.argv,
    workDir = process.cwd();

// Configuration vars
var buildInfo, workFiles;

// Clean args.
args.shift(); // node
args.shift(); // ember-runner

runner.task('default', 'Run preview server', ['preview'], function(callback) {
  callback(null, true);
});

runner.task('preview', 'Run preview server', ['watch'], function(callback) {
  runner.runServer(buildInfo.server, function(err, success) {
    callback(null, true);    
  });
});

runner.task('watch', 'Watch for files changes', ['build'], function(callback) {
  pm.watchForChanges(function(err, success) {
    callback(null, true);
  });
});

runner.task('build', 'Build libraries and applications', ['task:configure', 'task:clean', 'vendors', 'apps', 'task:checkPackages', 'task:walk'], function(callback) {
  pm.build(function(err, success) {
    var distInfos = pm.distributions,
        pending = distInfos.length;
    
    distInfos.forEach(function(distInfo) {
      distInfo.distributeIt(function(err, success) {
        if (--pending === 0) callback(null, true);
      });
    });
  });
});

runner.task('tests', 'Build tests', ['build'], function(callback) {
  callback(null, true);
});

runner.task('apps', 'Generate applications libraries', function(callback) {
  var apps = buildInfo.apps,
      distributions = apps.distributions,
      packages, distPackages, name;
  
  for (var dist in distributions) {
    distPackages = [];
    
    packages = distributions[dist];
    packages.forEach(function(pack) {
      name = pack.split('/');
      name = name[name.length - 1];
      
      distPackages.push(pm.createPackage({
        isApp: true,
        name: name,
        path: [buildInfo.srcApps, pack].join('/'),
        smallPath: pack,
        styles: apps.styles,
        static: apps.static,
        templates: apps.templates,
        scripts: apps.scripts
      }));
    });

    pm.createDistInfo({
      isApp: true,
      name: dist,
      packages: distPackages,
      output: [buildInfo.apps.output, dist].join('/')
    });    
  }
  
  callback(null, true);
});

runner.task('vendors', 'Generate vendors libraries', function(callback) {
  var vendors = buildInfo.vendors,
      distributions = vendors.distributions,
      packages, distPackages, name;

  for (var dist in distributions) {    
    distPackages = [];
    
    packages = distributions[dist];    
    packages.forEach(function(pack) {
      name = pack.split('/');
      name = name[name.length - 1];
      
      distPackages.push(pm.createPackage({
        isVendor: true,
        name: name,
        path: [buildInfo.srcVendors, pack].join('/'),        
        smallPath: pack,
        styles: vendors.styles,
        static: vendors.static,
        templates: vendors.templates,
        scripts: vendors.scripts
      }));
    });
    
    pm.createDistInfo({
      isVendor: true,
      name: dist,
      packages: distPackages,
      output: buildInfo.vendors.output
    });
  }
  
  callback(null, true);
});

// ================
// = GENERIC TASK =
// ================

runner.task('task:clean', 'Clean all generated directories', function(callback) {
  var pending = 2;
  
  // remove public/apps folder
  fs.rmdir(buildInfo.apps.output, function(err) {
    if (--pending === 0) callback(null, true);
  });
  
  fs.rmdir(buildInfo.vendors.output, function(err) {
    if (--pending === 0) callback(null, true);
  });
  
});

runner.task('task:configure', 'Retrieve configuration parameters', ['task:checkConfig'], function(callback) {
  var self = this, key, devBuildInfo;
  
  fs.readFile([__dirname, 'ember_runner_config.json'].join('/'), function(err, file) {
    if (err) return callback("Error no ember_runner_config.json file found");
    
    buildInfo = JSON.parse(file);
    
    fs.readFile([workDir, 'ember_runner_config.json'].join('/'), function(err, file) {
      if (err) return callback("Error no ember_runner_config.json file found");

      devBuildInfo = JSON.parse(file);
    
      // merge devBuildInfo keys with buildInfo
      
      // first apps
      if (devBuildInfo.apps) {
        for(key in devBuildInfo.apps) { 
          buildInfo.apps[key] = devBuildInfo.apps[key]; 
        }
      }
      
      // then vendors without distribution
      if (devBuildInfo.vendors) {
        for(key in devBuildInfo.vendors) { 
          if (key != 'distributions') buildInfo.vendors[key] = devBuildInfo.vendors[key];
        }
      }
      
      // vendor's distribution
      if (devBuildInfo.vendors.distributions) {
        for(key in devBuildInfo.vendors.distributions) { 
          buildInfo.vendors.distributions[key] = devBuildInfo.vendors.distributions[key];
        }
      }
      
      // server without proxies
      if (devBuildInfo.server) {
        for(key in devBuildInfo.server) { 
          if (key != 'proxy') buildInfo.server[key] = devBuildInfo.server[key];
        }
      }
      
      // server's proxy
      if (devBuildInfo.server.proxy) {
        for(key in devBuildInfo.server.proxy) { 
          buildInfo.server.proxy[key] = devBuildInfo.server.proxy[key];
        }
      }
      
      // Generate generics attributes
      buildInfo.srcApps = [workDir, buildInfo.apps.input].join('/');
      buildInfo.srcVendors = [workDir, buildInfo.vendors.input].join('/');
      buildInfo.tmpApps = [workDir, buildInfo.tmpDir, buildInfo.apps.input].join('/');
      buildInfo.tmpVendors = [workDir, buildInfo.tmpDir, buildInfo.vendors.input].join('/');
      buildInfo.tgtApps = [workDir, buildInfo.apps.output].join('/');
      buildInfo.tgtVendors = [workDir, buildInfo.vendors.output].join('/');

      // Generate apps distribution if not found
      if (!buildInfo.apps.distributions) {
        buildInfo.apps.distributions = {};
        fs.readdir(buildInfo.srcApps, function(err, lists) {
          if (err) return callback("There no applications found, nothing to do.\nCreate one with ember-runner -g app <your app>");
        
          lists.forEach(function(list) {
            buildInfo.apps.distributions[list] = [list];
          });
        
          callback(null, true);        
        });
      } else {
        callback(null, true);
      }
      
    });      
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

runner.task('task:checkConfig', 'Check if the working directory is a valid ember-runner project', function(callback) {
  fs.stat('ember_runner_config.json', function(err, stat) {
    if (err) return callback("This is not a valid ember-runner project, no ember_runner_config.json found.\nGenerate one with: ember-runner --initialize/-i", true);
    callback(null, true);
  });
});
  
runner.task('task:checkPackages', 'Retrieve configuration parameters', function(callback) {
  var packages = pm.packages, errors = [], pending;
  
  if (!packages || packages.length === 0) return callback('No packages found (apps and vendors), nothing to do.');
  
  pending = packages.length;
  
  packages.forEach(function(pack) {
    fs.stat(pack.path, function(err) {
      if (err) errors.push('Package: ' + pack.name +' ([' + (pack.isVendor ? 'vendors' : 'apps') +'/]' + pack.smallPath + ') not found, please add it in vendors');
      if (--pending === 0) {
        if (errors.length > 0) return callback(errors.join('\n'));
        callback(null, true);
      }
    });
  });
});