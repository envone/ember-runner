var async = require('async'),
    fs = require('fs'),
    path = require('path'),
    helpers = require('./helpers'),
    handlersManager = require('./handlers');

var Package = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

Package.prototype = new function () {
  
  this.scannedFiles = null;
  
  this.initialize = function(options) {
    var key;
    
    for(key in options) {
      this[key] = options[key];
    }
    
    this.libPath = [this.path, this.scripts].join('/');
  };
  
  this.scanFiles = function(path, callback) {
    var self = this;
    
    helpers.walk(path, { package: this}, function(err, results) {
      if (err) return callback("Error scaning files for: " + self.name);
      
      self.scannedFiles = results.files;
      self.scannedDirs = results.dirs;      
      self.scannedStylesheets = [];
      self.scannedScripts = [];
      self.scannedTemplates = [];

      self.scannedFiles.forEach(function(file) {
        if (file.isStylesheet()) self.scannedStylesheets.push(file);
        else if (file.isScript()) self.scannedScripts.push(file);
        else if (file.isTemplate()) self.scannedTemplates.push(file);
        //else console.log('Unknown file type: ' + file.path);
      });
      
      callback(null, true);
    });
  };
  
  this.build = function(callback) {
    //console.log('[Build] Package: ' + this.name);
    
    var self = this;
    
    this.scanFiles(this.path, function(err, success) {
      if (err) return callback(err);

      async.series({
        buildStyles: function(inlineCallback) {
          self.buildStyles(inlineCallback);
        },
        buildScripts: function(inlineCallback) {
          self.buildScripts(inlineCallback);
        },
        buildTemplates: function(inlineCallback) {
          self.buildTemplates(inlineCallback);
        }
      }, function(err, results) {
        callback(null, true);        
      });
      
    });
  };
  
  this.watchForChanges = function(callback) {
    
  };
  
  this.packageLoadAfter = function(packageName) {
    var packages = this.packageManager.packages,
        len = packages.length, pack, i, loadAfter = true;
    
    for(i = 0; i<len; i++) {
      pack = packages[i];
      if (pack.name == packageName) {
        break;
      } else if (pack.name == this.name) {
        loadAfter = true;
        break;
      }
    }    
    
    return loadAfter;
  };
  
  // ===========
  // = Scripts =
  // ===========
  
  this.computeDependencies = function(scannedScripts, callback) {
    var pending = scannedScripts.length,
        regexp = new RegExp("require\\([\"']([a-zA-Z_\\-\\/]*)[\"']\\)\\;", "g"),
        self = this, match, path;
    
    scannedScripts.forEach(function(file) {
      file.readFile(function(err, data) {
        if (data) {
          file.deps = [];
          while(match = regexp.exec(data)) {
            path = match[1];
            file.deps.push(path);
          }          
        }
        
        if (--pending === 0) callback(null, self.scannedScripts);
      });
    });
  };
  
  this.sortDependencies = function(file, orderedFiles, files, recursionHistory) {
    var self = this, urlPackage, externalPackage, externalFiles, len, found, i;

    if (recursionHistory === undefined) recursionHistory = [];

    // prevent infinite loop
    if (recursionHistory.indexOf(file) !== -1) return;
    recursionHistory.push(file);

    if (orderedFiles.indexOf(file) === -1) {
      if (file.deps) {
        file.deps.forEach(function(url) {
          // Check if are the same package
          urlPackage = url.split('/')[0];
          
          if (urlPackage === self.name) {
            len = files.length;
            found = false;

            for (i = 0; i < len; ++i) {
              if (files[i].url === url) {
                found = true;
                self.sortDependencies(files[i], orderedFiles, files, recursionHistory);
                break;
              }
            }

            if (!found) console.log('WARNING: ' + url + ' is required in ' + file.url + ' but does not exists.');
          } else {
            externalPackage = self.packageManager.retrievePackage(urlPackage);
            if (externalPackage && url === urlPackage) {
              // Check only if the external package load before the acutal package
              if (!self.packageLoadAfter(externalPackage)) {
                console.log('WARNING: Package: ' + self.name + ' loads before than external package: ' + urlPackage);
              }
            } else if (externalPackage && externalPackage.scannedScripts) {
              externalFiles = externalPackage.scannedScripts;
              len = externalFiles.length;
              found = false;

              for (i = 0; i < len; ++i) {
                if (externalFiles[i].url === url) {
                  found = true;
                  break;
                }
              }
              
              if (!found) console.log('EXTERNAL WARNING: ' + url + ' is required in ' + file.url + ' but does not exists.');
            } else {
              console.log('EXTERNAL PACKAGE WARNING: ' + url + ' package is required in ' + file.url + ' but does not exists.');
            }
          }
        });
      }

      orderedFiles.push(file);
    }
  };
  
  this.orderScripts = function(scannedScripts, callback) {
    var self = this;
    
    this.computeDependencies(scannedScripts, function(err, computedScripts) {
      var orderScripts = [],
          sortedScripts;
      
      // order script alphabetically by path
      sortedScripts = computedScripts.sort(function(a, b) {
        return a.path.localeCompare(b.path);
      });
      
      //console.log(sortedScripts);
      sortedScripts.forEach(function(script) {
        self.sortDependencies(script, orderScripts, sortedScripts);
      });
      
      //console.log('-> SORTED');
      //sortedScripts.forEach(function(file) { console.log(file.path); });
      //console.log('-> ORDERED');
      //orderScripts.forEach(function(file) { console.log(file.url); });
      
      callback(null, orderScripts);
    });
  };

  this.buildScripts = function(callback) {
    var scannedScripts = this.scannedScripts,
        handlers = [],
        self = this, pending;
    
    if (scannedScripts.length > 0) {
      this.orderScripts(scannedScripts, function(err, orderedScripts) {
        // Apply handlers for each ordered file
        handlers.push("removeRequires");
        handlers.push('encloseExportFunction');
        
        pending = orderedScripts.length;
        
        orderedScripts.forEach(function(script) {
          var buffer = script.content,
              starter;

          starter = function(callback) {
            callback(null, buffer);
          };
          
          handlersManager.run(starter, handlers, function(err, processedBuffer) {
            script.buffer = processedBuffer;
            
            if (--pending === 0) {
              self.orderedScripts = orderedScripts;
              callback(null, true);
            }
          });
        });
      });
    } else {
      // No scripts found.
      callback(null, true);
    }  
  };
  
  // ==========
  // = Styles =
  // ==========
  
  this.buildStyles = function(callback) {
    callback(null, true);
  };
  
  // ==========================
  // = Templates / Handlebars =
  // ==========================
  
  this.buildTemplates = function(callback) {
    callback(null, true);
  };
  
}();

Package.prototype.constructor = Package;

var packageManager = new function() {  
  this.packages = [];
  
  this.createPackage = function(options) {
    options.packageManager = this;
    this.packages.push(new Package(options));
  };
  
  this.build = function(callback) {
    console.log('Packages to Build: ' + this.packages.length);
    
    async.forEachSeries(this.packages, function(pack, inlineCallback) {
      pack.build(inlineCallback);
    }, callback);
  };
  
  this.watchForChanges = function(callback) {
    callback(null, true);
  };
  
  this.generateDistributionsFor = function(distInfo, callback) {
    var self = this,
        packages = [], scripts = [];
    
    distInfo.packages.forEach(function(package) {
      packages.push(self.retrievePackage(package));
    });
    
    packages.forEach(function(package) {
      //console.log(distInfo.name + ' -> ' + package.name);
      
      // concat styles
      
      // concat scripts
      package.orderedScripts.forEach(function(script) {
        scripts.push(script.buffer);
      });
      
      // concat templates
      
      // concat statics
    });
    
    helpers.mkdir_p(distInfo.output, 0777, function(err, success) {
      fs.writeFile(path.join(distInfo.output, distInfo.name + '.js'), scripts.join('\n'), function(err) {
        if (err) console.log(err);
        callback(null, true);
      });
    });
  };
  
  this.retrievePackage = function(packageName) {
    var found = null;
    this.packages.forEach(function(package) {
      if (package.name == packageName) found = package;
    });
    return found;
  };
  
}();

module.exports = packageManager;