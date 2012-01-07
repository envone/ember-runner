var async = require('async'),
    helpers = require('./helpers');

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
  
  // ===========
  // = Scripts =
  // ===========
  
  this.computeDependencies = function(scannedScripts, callback) {
    var pending = scannedScripts.length,
        regexp = new RegExp("require\\([\"']([a-zA-Z\\-\\/]*)[\"']\\)\\;", "g"),
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
    var self = this, urlPackage, externalPackage, len, found, i;

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
            if (externalPackage && externalPackage.scannedScripts) {
              /*
              var len = files.length,
                  found = false, i;

              for (i = 0; i < len; ++i) {
                if (files[i].url === url) {
                  found = true;
                  self.sortDependencies(files[i], orderedFiles, files, recursionHistory);
                  break;
                }
              }
              */
            } else {
              console.log('EXTERNAL WARNING: ' + url + ' is required in ' + file.url + ' but does not exists.');
              //console.log('EXTERNAL PACKAGE NOT FOUND: ' + urlPackage + " in " + file.);
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
      //orderScripts.forEach(function(file) { console.log(file.path); });
      //console.log(sortedScripts);
      //console.log(orderScripts);
      
      callback(null, true);
    });
  };

  this.buildScripts = function(callback) {
    var scannedScripts = this.scannedScripts;
    
    if (scannedScripts.length > 0) {
      this.orderScripts(scannedScripts, function(err, success) {
        callback(null, true);
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
    
  };
  
  this.deploy = function(callback) {
    
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