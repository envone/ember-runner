var async = require('async'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),    
    helpers = require('./helpers'),
    watch = require('watch'),
    File = require('./file'),
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
      self.scannedStyles = [];
      self.scannedScripts = [];
      self.scannedTemplates = [];
      
      self.scannedFiles.forEach(function(file) {
        if (file.isStylesheet()) self.scannedStyles.push(file);
        else if (file.isScript()) self.scannedScripts.push(file);
        else if (file.isTemplate()) self.scannedTemplates.push(file);
        //else console.log('Unknown file type: ' + file.path);
      });
      
      callback(null, self.scannedFiles);
    });
  };
  
  this.build = function(callback) {
    console.log('[Build] Package: ' + this.name);
    
    var self = this;
    
    this.scanFiles(this.path, function(err, scannedFiles) {
      if (err) return callback(err);

      self.readScannedFiles(scannedFiles, function(err, success) {
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
    });
  };
  
  this.readScannedFiles = function(scannedFiles, callback) {
    var pending = scannedFiles.length;
      
    scannedFiles.forEach(function(file) {
      file.readFile(function(err, data) {
        if (--pending === 0) callback(null, true);
      });
    });
  };
  
  this.watchForChanges = function(callback) {
    var self = this,
        changedFile;
    
    watch.watchTree(this.path, function (f, curr, prev) {
      if (typeof f == "object" && prev === null && curr === null) {
        // Finished walking the tree
        callback(null, true);
      } else if (prev === null) {
        // f is a new file, add it to the scannedFiles
        console.log('[ADDED] ' + f);
        changedFile = new File({
          path: f,
          package: self
        });
        
        // remove from scanned files        
        self.scannedFiles.push(changedFile);
        
        if (changedFile.isStylesheet()) {
          // push from styles
          self.scannedStyles.push(changedFile);
          // rebuild
          self.rebuildStyle(changedFile);
        } else if (changedFile.isTemplate()) {
          // push from templates
          self.scannedTemplates.push(changedFile);
          // rebuild
          self.rebuildTemplate(changedFile);
        } else if (changedFile.isScript()) {
          // push from scripts
          self.scannedScripts.push(changedFile);
          // rebuild
          self.rebuildScript(changedFile);
        }
      } else if (curr.nlink === 0) {
        // f was removed, remove it from the scannedFiles
        console.log('[REMOVED] ' + f);
        changedFile = self.retrieveFile(f);
        
        // remove from scanned files        
        self.scannedFiles.splice(self.scannedFiles.indexOf(changedFile), 1);
        
        if (changedFile.isStylesheet()) {
          // remove from styles
          self.scannedStyles.splice(self.scannedStyles.indexOf(changedFile), 1);
          // rebuild
          self.distInfo.distributeIt('styles', function(err, success) {
            if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding styles');
            else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt styles');
          });
        } else if (changedFile.isTemplate()) {
          // remove from templates
          self.scannedTemplates.splice(self.scannedTemplates.indexOf(changedFile), 1);
          // rebuild
          self.distInfo.distributeIt('templates', function(err, success) {
            if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding templates');
            else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt templates');            
          });
        } else if (changedFile.isScript()) {
          // remove from scripts
          self.scannedScripts.splice(self.scannedScripts.indexOf(changedFile), 1);
          // rebuild all scripts
          self.rebuildScripts();
        }        
      } else {
        // f was changed
        changedFile = self.retrieveFile(f);
        
        if (changedFile.isStylesheet()) self.rebuildStyle(changedFile);
        else if (changedFile.isTemplate()) self.rebuildTemplate(changedFile);
        else if (changedFile.isScript()) self.rebuildScript(changedFile);
      }
    });    
  };
  
  this.retrieveFile = function(path) {
    var found = null;
    this.scannedFiles.forEach(function(file) {
      if (file.path == path) found = file;
    });
    return found;    
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
        self = this, match, path, data;
    
    scannedScripts.forEach(function(file) {
      data = file.content;
      
      if (data) {
        file.deps = [];
        while(match = regexp.exec(data)) {
          path = match[1];
          file.deps.push(path);
        }          
      }
        
      if (--pending === 0) callback(null, self.scannedScripts);
    });
  };
  
  /**
    Load deps on an array, and then remove these script that are not in
    deps.
  */
  this.cleanUnusedScripts = function(scannedFiles, level) {
    var mainJSPath = path.join(this.name, 'main'),
        deps = {}, used = [], unused = [], mainJS;
    
    if (level === undefined) level = 0;
    
    scannedFiles.forEach(function(file) {
      //console.log(file.url + ' === ' + mainJSPath);
      if (file.deps) {
        file.deps.forEach(function(depency) {
          deps[depency] = true;
        });
      }
      if (file.url === mainJSPath) {
        // because main.js isn't required by onyone we need
        // to add it manually later.
        mainJS = file;
      }
    });
    
    for(var depency in deps) {
      scannedFiles.forEach(function(file) {
        if (file.url === depency) used.push(file);
      });
    }
        
    // Add main.js if exist to used depedency.
    if (mainJS && used.indexOf(mainJS) === -1) {
      used.push(mainJS);
    }
    
    //console.log('---> SCANNED');
    //scannedFiles.forEach(function(file) { console.log(file.url); });
    //console.log('---> USED');
    //used.forEach(function(file) { console.log(file.url); });
    
    scannedFiles.forEach(function(file) {
      if (used.indexOf(file) === -1) {
        console.log('[WARN] [UNUSED FILE] [Level: ' + level + '] ' + file.url);
        unused.push(file);
      }
    });
    
    if (unused.length > 0 && used.length > 0) {
      return this.cleanUnusedScripts(used, level++);
    } else {
      return used;
    }
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
      var orderScripts = [], usedScripts,
          mainJSPath = path.join(self.name, 'main'),
          sortedScripts, mainJS;
      
      // Before sort, remove these files that have no dependency
      usedScripts = self.cleanUnusedScripts(computedScripts);
      
      sortedScripts = usedScripts.sort(function(a, b) {
        return a.path.localeCompare(b.path);
      });
      
      // order script alphabetically by path
      /*sortedScripts = computedScripts.sort(function(a, b) {
        return a.path.localeCompare(b.path);
      });*/
      
      // strings.js first
      sortedScripts.forEach(function(script) {
        if (/strings\.js$/.test(script.path)) {
          self.sortDependencies(script, orderScripts, sortedScripts);
        }
        if (script.url == mainJSPath) mainJS = script;
      });

      // then main.js and its dependencies
      if (mainJS) {
        self.sortDependencies(mainJS, orderScripts, sortedScripts);
        sortedScripts.forEach(function(script) {
          if (script.deps && script.deps.indexOf(mainJS.url) !== -1) {
            self.sortDependencies(script, orderScripts, sortedScripts);
          }
        });
      }
      
      // and then the rest
      sortedScripts.forEach(function(script) {
        self.sortDependencies(script, orderScripts, sortedScripts);
      });
      
      //console.log('-> SORTED');
      //sortedScripts.forEach(function(file) { console.log(file.path); });
      //console.log('-> ORDERED');
      //orderScripts.forEach(function(file) { console.log(file.url); });
      
      self.orderedScripts = orderScripts;
      
      callback(null, true);
    });
  };

  this.buildScripts = function(callback) {
    var scannedScripts = this.scannedScripts,
        self = this, pending, orderedScripts;
    
    // Nothing to do.
    if (!scannedScripts || scannedScripts.length === 0) return callback(null, null);
    
    this.orderScripts(scannedScripts, function(err, success) {
      orderedScripts = self.orderedScripts;
      pending = orderedScripts.length; 
             
      orderedScripts.forEach(function(script) {
        self.buildScriptBuffer(script, function(err, success) {
          if (--pending === 0) callback(null, true);        
        });
      });
    });     
  };
  
  this.buildScriptBuffer = function(script, callback) {
    var handlers = [], starter;
    
    // Apply handlers for each ordered file
    handlers.push("removeRequires");
    handlers.push('encloseExportFunction');
    
    starter = function(callback) {
      callback(null, {
        buffer: script.content
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      
      script.buffer = processedContext.buffer;        
      callback(null, true);
    });
  };
  
  this.rebuildScript = function(script) {
    var scannedScripts = this.scannedScripts,
        self = this;
    
    script.readFile(function(err, data) {
      self.buildScriptBuffer(script, function(err, success) {
        // order scripts again to check for require errors
        self.orderScripts(scannedScripts, function(err, success) {
          self.distInfo.distributeIt('scripts', function(err, success) {
            if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing script: ' + script.name + script.extnam);
            else console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + script.name + script.extname + ' was republished');
          });
        });
      });
    });
  };
  
  this.rebuildScripts = function() {
    var scannedScripts = this.scannedScripts,
        self = this;
    
    self.orderScripts(scannedScripts, function(err, success) {
      self.distInfo.distributeIt('scripts', function(err, success) {
        if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding scripts');
        else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt scripts');
      });
    });
  };
  
  // ==========
  // = Styles =
  // ==========
  
  this.buildStyles = function(callback) {
    var scannedStyles = this.scannedStyles,
        self = this, pending;
        
    // Nothing to do.
    if (!scannedStyles || scannedStyles.length === 0) return callback(null, null);
    
    pending = scannedStyles.length;
      
    scannedStyles.forEach(function(style) {
      self.buildStyleBuffer(style, function(err, success) {
        if (--pending === 0) callback(null, true);        
      });
    });
  };
  
  this.buildStyleBuffer = function(style, callback) {
    var handlers = [], starter;
    
    handlers.push(style.extname.replace('.', ''));
    
    starter = function(callback) {
      callback(null, {
        file: style,
        buffer: style.content
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      
      style.buffer = processedContext.buffer;        
      callback(null, true);
    });
  };
  
  this.rebuildStyle = function(style) {
    var self = this;
    
    style.readFile(function(err, data) {
      self.buildStyleBuffer(style, function(err, success) {
        self.distInfo.distributeIt('styles', function(err, success) {
          if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing style: ' + style.name + style.extnam);
          else console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + style.name + style.extname + ' was republished');
        });
      });
    });
  };
  
  // ==========================
  // = Templates / Handlebars =
  // ==========================
  
  this.buildTemplates = function(callback) {
    var scannedTemplates = this.scannedTemplates,
        self = this, pending;
        
    // Nothing to do.
    if (!scannedTemplates || scannedTemplates.length === 0) return callback(null, null);
      
    pending = scannedTemplates.length;
      
    scannedTemplates.forEach(function(template) {
      self.buildTemplateBuffer(template, function(err, success) {
        if (--pending === 0) callback(null, true);
      });
    });
  };
  
  this.buildTemplateBuffer = function(template, callback) {
    var handlers = [], starter;
    
    handlers.push("includeTemplate");
    handlers.push('encloseExportFunction');
    
    starter = function(callback) {
      callback(null, {
        file: template,
        buffer: template.content
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      
      template.buffer = processedContext.buffer;        
      callback(null, true);
    });
  };
  
  this.rebuildTemplate = function(template) {
    var self = this;
    
    template.readFile(function(err, data) {
      self.buildTemplateBuffer(template, function(err, success) {
        self.distInfo.distributeIt('templates', function(err, success) {
          if (err) return console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing style: ' + template.name + template.extnam);
          else console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + template.name + template.extname + ' was republished');
        });
      });
    });
  };
  
}();

Package.prototype.constructor = Package;

// ================
// = DISTRIBUTION =
// ================

var DistInfo = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

DistInfo.prototype = new function () {
  
  /**
    Options must have:
    - name
    - output
    - packages
  */
  this.initialize = function(options) {
    var key;
    
    for(key in options) {
      this[key] = options[key];
    }
  };
  
  this.distributeIt = function(target, callback) {
    var self = this, pending = 0,
        styles = [], scripts = [], templates = [];
    
    if (!callback) {
      callback = target;
      target = 'all';
    }
    
    this.packages.forEach(function(pack) {
      
      // concat styles
      if (target.match(/(all|styles)/)) {
        pack.scannedStyles.forEach(function(style) {
          styles.push(style.buffer);
        });
      }
      
      // concat scripts
      if (target.match(/(all|scripts)/)) {
        pack.orderedScripts.forEach(function(script) {
          scripts.push(script.buffer);
        });
      }
      
      // concat templates
      if (target.match(/(all|templates)/)) {
        pack.scannedTemplates.forEach(function(script) {
          templates.push(script.buffer);
        });
      }
      
      // concat statics
    });
    
    if (styles.length > 0) pending++;
    if (scripts.length > 0) pending++;
    if (templates.length > 0) pending++;
    
    if (pending > 0) {
      mkdirp(this.output, function(err, success) {

        if (styles.length > 0) {
          //Save templates
          fs.writeFile(path.join(self.output, self.name + '.css'), styles.join('\n'), function(err) {
            if (err) return callback(err);
            if (--pending === 0) callback(null, true);
          });
        }
        
        if (scripts.length > 0) {
          // Save scripts
          fs.writeFile(path.join(self.output, self.name + '.js'), scripts.join('\n'), function(err) {
            if (err) return callback(err);
            if (--pending === 0) callback(null, true);
          });
        }
        
        if (templates.length > 0) {
          //Save templates
          fs.writeFile(path.join(self.output, self.name + '_templates.js'), templates.join('\n'), function(err) {
            if (err) return callback(err);
            if (--pending === 0) callback(null, true);
          });
        }

      });
    } else {
      callback(null, true);
    }
  };
  
}();

DistInfo.prototype.constructor = DistInfo;
  
// ===================
// = PACKAGE MANAGER =
// ===================

var packageManager = new function() {  
  this.packages = [];
  this.distributions = [];
  
  this.createPackage = function(options) {
    var pack;
    
    // Add reference to package manager.
    options.packageManager = this;
    
    // create package and push it to packages
    pack = new Package(options);    
    
    this.packages.push(pack);
    
    //return new package
    return pack;
  };
  
  this.createDistInfo = function(options) {
    var distInfo = new DistInfo(options);
    
    // Reference which distribution info belong the package.
    distInfo.packages.forEach(function(pack) {
      pack.distInfo = distInfo;
    });
    
    this.distributions.push(distInfo);
  };
  
  this.build = function(callback) {
    //console.log('Packages to Build: ' + this.packages.length);    
    async.forEachSeries(this.packages, function(pack, inlineCallback) {
      pack.build(inlineCallback);
    }, callback);
  };
  
  this.watchForChanges = function(callback) {
    // console.log('Packages to watch: ' + this.packages.length);    
    async.forEachSeries(this.packages, function(pack, inlineCallback) {
      pack.watchForChanges(inlineCallback);
    }, callback);
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