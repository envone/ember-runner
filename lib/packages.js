var async = require('async'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),    
    helpers = require('./helpers'),
    watch = require('watch'),
    File = require('./file'),
    exec = require('child_process').exec,
    handlersManager = require('./handlers'),
    RunnerServer = require('./server');

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
      self.scannedStatics = [];
      
      self.scannedFiles.forEach(function(file) {
        if (file.isStylesheet()) self.scannedStyles.push(file);
        else if (file.isScript()) self.scannedScripts.push(file);
        else if (file.isTemplate()) self.scannedTemplates.push(file);
        else if (file.isStatic()) self.scannedStatics.push(file);
        else console.log('Unknown file type: ' + file.path);
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
          buildStatics: function(inlineCallback) {
            self.buildStatics(inlineCallback);
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
    var self = this, changedFile;

    watch.watchTree(this.path, { callback: callback }, function (f, curr, prev) {
      if (typeof f === "object" && prev === null && curr === null) {
        console.log('[Watch] ready to watch:', self.name);
        // Finished walking the tree
      } else {
        // ignore files that start with '.', this is a bug from watchTree
        // that we prevent here.      
        if (f.match(/(.git|.sass|.bpm|.DS_Store|.svn)/)) return;
        
        var server = self.packageManager.runnerServer, rebuiltCallback;
        
        rebuiltCallback = function(err, success) {
          server.removeFromQueue(f);
        };
        
        server.addToQueue(f);
        
        if (prev === null) {
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
            self.rebuildStyle(changedFile, rebuiltCallback);
          } else if (changedFile.isTemplate()) {
            // push from templates
            self.scannedTemplates.push(changedFile);
            // rebuild
            self.rebuildTemplate(changedFile, rebuiltCallback);
          } else if (changedFile.isScript()) {
            // push from scripts
            self.scannedScripts.push(changedFile);
            // rebuild
            self.rebuildScript(changedFile, rebuiltCallback);
          } else if (changedFile.isStatic()) {
            // push from scripts
            self.scannedStatics.push(changedFile);
            // rebuild
            self.rebuildStatic(changedFile, rebuiltCallback);            
          }
        } else if (curr.nlink === 0) {
          // f was removed, remove it from the scannedFiles
          console.log('[REMOVED] ' + f);
          changedFile = self.retrieveFile(f);

          // If null means that is not a file that we have managed before
          // or should be a directoy, so ignore it.
          if (!changedFile) return;

          // remove from scanned files        
          self.scannedFiles.splice(self.scannedFiles.indexOf(changedFile), 1);

          if (changedFile.isStylesheet()) {
            // remove from styles
            self.scannedStyles.splice(self.scannedStyles.indexOf(changedFile), 1);
            // rebuild
            self.distInfo.distributeIt('styles', function(err, success) {
              if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding styles');
              else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt styles');
              
              server.removeFromQueue(f);
            });
          } else if (changedFile.isTemplate()) {
            // remove from templates
            self.scannedTemplates.splice(self.scannedTemplates.indexOf(changedFile), 1);
            // rebuild
            self.distInfo.distributeIt('templates', function(err, success) {
              if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding templates');
              else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt templates');
              
              server.removeFromQueue(f);
            });
          } else if (changedFile.isScript()) {
            // remove from scripts
            self.scannedScripts.splice(self.scannedScripts.indexOf(changedFile), 1);
            // rebuild all scripts
            self.rebuildScripts(function(err, success) {
              server.removeFromQueue(f);
            });
          } else if (changedFile.isStatic()) {
            // remove from styles
            self.scannedStatics.splice(self.scannedStatics.indexOf(changedFile), 1);
            // rebuild
            self.distInfo.distributeIt('statics', function(err, success) {
              if (err) console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding statics');
              else console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt statics');
              
              server.removeFromQueue(f);
            });
          }
        } else {
          // f was changed
          console.log('[UPDATED] ' + f);
          changedFile = self.retrieveFile(f);

          if (changedFile.isStylesheet()) self.rebuildStyle(changedFile, rebuiltCallback);
          else if (changedFile.isTemplate()) self.rebuildTemplate(changedFile, rebuiltCallback);
          else if (changedFile.isScript()) self.rebuildScript(changedFile, rebuiltCallback);
          else if (changedFile.isStatic()) self.rebuildStatic(changedFile, rebuiltCallback);
        }
      }
    });

    callback(null);
  };
  
  this.retrieveFile = function(path) {
    var found = null;
    this.scannedFiles.forEach(function(file) {
      if (file.path === path) found = file;
    });
    return found;    
  };
  
  this.packageLoadAfter = function(packageName) {
    var packages = this.packageManager.packages,
        len = packages.length, pack, i, loadAfter = true;
    
    for(i = 0; i<len; i++) {
      pack = packages[i];
      if (pack.name === packageName) {
        break;
      } else if (pack.name === this.name) {
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
        //regexp = new RegExp("require\\([\"']([a-zA-Z_\\-\\/]*)[\"']\\)\\;", "g"),
        regexp = new RegExp("^require\\([\"']([a-zA-Z_\\-\\/]*)[\"']\\)\\;", "gm"),
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
    if (this.packageManager.enableMinify) handlers.push('removeAssertions');
    handlers.push('encloseExportFunction');
    //console.log(script.path);
    //console.log(script.path.endsWith('packages/loader/lib/main.js'));

    starter = function(callback) {
      callback(null, {
        file: script,
        buffer: script.content
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      
      script.buffer = processedContext.buffer;        
      callback(null, true);
    });
  };
  
  this.rebuildScript = function(script, callback) {
    var scannedScripts = this.scannedScripts,
        self = this;
    
    script.readFile(function(err, data) {
      self.buildScriptBuffer(script, function(err, success) {
        // order scripts again to check for require errors
        self.orderScripts(scannedScripts, function(err, success) {
          self.distInfo.distributeIt('scripts', function(err, success) {
            if (err) {
              console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing script: ' + script.name + script.extnam);
              callback(true);
            } else {
              console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + script.name + script.extname + ' was republished');
              callback(null, true);
            }
          });
        });
      });
    });
  };
  
  this.rebuildScripts = function(callback) {
    var scannedScripts = this.scannedScripts,
        self = this;
    
    self.orderScripts(scannedScripts, function(err, success) {
      self.distInfo.distributeIt('scripts', function(err, success) {
        if (err) {
          console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error rebulding scripts');
          callback(true);
        } else {
          console.log('[HOT DEPLOY] [' + self.name + '] Rebuilt scripts');
          callback(null, true);
        }
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
  
  this.rebuildStyle = function(style, callback) {
    var self = this;
    
    style.readFile(function(err, data) {
      self.buildStyleBuffer(style, function(err, success) {
        self.distInfo.distributeIt('styles', function(err, success) {
          if (err) {
            console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing style: ' + style.name + style.extnam);
            callback(true);
          } else {
            console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + style.name + style.extname + ' was republished');
            callback(null, true);
          }
        });
      });
    });
  };
  
  // ==========================
  // = Templates / Handlebars =
  // ==========================
  
  this.buildTemplates = function(context, callback) {
    var scannedTemplates = this.scannedTemplates,
        self = this, pending;
        
    // Nothing to do.
    if (!scannedTemplates || scannedTemplates.length === 0) return callback(null, null);
      
    pending = scannedTemplates.length;
      
    scannedTemplates.forEach(function(template) {
      self.buildTemplateBuffer(context, template, function(err, success) {
        if (--pending === 0) callback(null, true);
      });
    });
  };
  
  this.buildTemplateBuffer = function(context, template, callback) {
    var handlers = [], starter, templatePath = this.templates;
    
    //if (this.packageManager.enableTemplatePrecompilation) 
    //handlers.push("includeCompiledTemplate");
    //else 
    handlers.push("includeTemplate");
    
    starter = function(callback) {
      callback(null, {
        dependencies: context,
        file: template,
        buffer: template.content,
        templatePath: templatePath
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      callback(null, processedContext.buffer);
    });
  };
  
  this.rebuildTemplate = function(template, callback) {
    var self = this;
    
    template.readFile(function(err, data) {
      //self.buildTemplateBuffer(template, function(err, success) {
        self.distInfo.distributeIt('templates', function(err, success) {
          if (err) {
            console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing template: ' + template.name + template.extnam);
            callback(true);
          } else {
            console.log('[HOT DEPLOY] [' + self.name + '] + Template ' + template.name + template.extname + ' was republished');
            callback(null, true);
          }
        });
      //});
    });
  };
  
  // =========
  // = Tests =
  // =========
  
  this.buildTests = function(callback) {
    callback(null, true);
  };
  
  this.buildTestBuffer = function(test, callback) {
    callback(null, true);
  };
  
  this.rebuildTest = function(test, callback) {
  };
  
  // ================
  // = Static Files =
  // ================
  
  this.buildStatics = function(callback) {
    var scannedStatics = this.scannedStatics,
        self = this, pending;
        
    // Nothing to do.
    if (!scannedStatics || scannedStatics.length === 0) return callback(null, null);
      
    pending = scannedStatics.length;
      
    scannedStatics.forEach(function(staticFile) {
      self.buildStaticBuffer(staticFile, function(err, success) {
        if (--pending === 0) callback(null, true);
      });
    });
  };
  
  this.buildStaticBuffer = function(staticFile, callback) {
    var handlers = [], starter;
    
    starter = function(callback) {
      callback(null, {
        file: staticFile,
        buffer: staticFile.content
      });
    };
    
    handlersManager.run(starter, handlers, function(err, processedContext) {
      if (err) return callback(err);
      
      staticFile.buffer = processedContext.buffer;        
      callback(null, true);
    });
  };
  
  this.rebuildStatic = function(staticFile, callback) {
    var self = this;
    
    staticFile.readFile(function(err, data) {
      self.buildStaticBuffer(staticFile, function(err, success) {
        self.distInfo.distributeIt('statics', function(err, success) {
          if (err) {
            console.log('[HOT DEPLOY] [WARN] [' + self.name + '] Error distributing static: ' + staticFile.name + staticFile.extnam);
            callback(true);
          } else {
            console.log('[HOT DEPLOY] [' + self.name + '] + Static ' + staticFile.name + staticFile.extname + ' was republished');
            callback(null, true);
          }
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
  
  this.enableMinify = false;
  
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
        styles = [], scripts = [], statics = [];
    
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
      /*if (target.match(/(all|templates)/)) {
        pack.scannedTemplates.forEach(function(script) {
          console.log(script.fullName);
          templates.push(script.buffer);
        });
      }*/

      // concat statics
      if (target.match(/(all|statics)/)) {
        statics = pack.scannedStatics;        
      }

    });
    
    if (statics.length > 0) pending = statics.length;
    if (styles.length > 0) pending++;
    if (scripts.length > 0) pending++;

    if (pending > 0) {
      mkdirp(this.output, function(err, success) {

        if (styles.length > 0) {
          //Save templates
          fs.writeFile(path.join(self.output, self.name + '.css'), styles.join('\n'), function(err) {
            if (err) return callback(err);
            if (--pending === 0) self.distributeTemplates(callback);
          });
        }
        
        if (scripts.length > 0) {
          // Save scripts
          var outputFile = path.join(self.output, self.name + '.js');
          var joinedScripts = scripts.join('\n'), starter, handlers = [];
          
          if (self.packageManager.enableMinify) {
            // Apply handlers for each ordered file
            handlers.push("uglify");
            
            starter = function(callback) {
              callback(null, {
                buffer: joinedScripts
              });
            };
            
            handlersManager.run(starter, handlers, function(err, processedContext) {
              joinedScripts = processedContext.buffer;        

              fs.writeFile(outputFile, joinedScripts, function(err) {
                if (err) return callback(err);
                if (--pending === 0) self.distributeTemplates(callback);
              });
            });
          } else {
            fs.writeFile(outputFile, joinedScripts, function(err) {
              if (err) return callback(err);
              if (--pending === 0) self.distributeTemplates(callback);
            });
          }
        }
        /*
        if (templates.length > 0) {
          //Save templates
          fs.writeFile(path.join(self.output, self.name + '_templates.js'), templates.join('\n'), function(err) {
            if (err) return callback(err);
            if (--pending === 0) self.distributeTemplates(callback);
          });
        }
        */
        if (statics.length > 0) {
          statics.forEach(function(staticFile) {
            //Save templates
            fs.writeFile(path.join(self.output, staticFile.name + staticFile.extname), staticFile.buffer, function(err) {
              if (err) return callback(err);
              if (--pending === 0) self.distributeTemplates(callback);
            });
          });
        }
        
      });
    } else {
      self.distributeTemplates(callback);
    }
  };
  
  this.distributeTemplates = function(callback) {
    var buffers = '', 
        pm = this.packageManager,
        deps = this.dependencies,
        self = this, context = {}, dist, distName, distPath, outputFile;        
        
    if (!deps) deps = [];
    
    deps.push(this.name);
      
    //deps.splice(deps.indexOf('jquery'), 1);
    //deps.splice(deps.indexOf('addons'), 1);    
    /*
    deps = ['ember'];
    
    console.log(deps);
        
    //handlers.push('encloseExportFunction');
    if (self.dependencies) {
      for(var i=0; i<deps.length; i++) {
        dist = pm.retrieveDistribution(deps[i]);
        distName = dist.name + '.js';
        distPath = path.join(dist.output, distName);
        
        context[distName] = fs.readFileSync(distPath, 'utf8');        
      }
    }    
    */
    console.log('[TEMPLATES] Building templates for: ' + this.name);
    
    async.each(this.packages, function(pack, outlineCallback) {
      
      async.each(pack.scannedTemplates, function(template, inlineCallback) {
        pack.buildTemplateBuffer(context, template, function(err, buffer) {
          if (err) return callback(err);          
          buffers = buffers + buffer;          
          inlineCallback(null, true);
        });

      }, function(err, results) {
        if (err) return outlineCallback(err);
        outlineCallback(null, true);
      });
      
    }, function(err, results) {
      if (err) return callback(err);
      
      outputFile = path.join(self.output, self.name + '_templates.js');
      
      // No templates found!.
      if (buffers === '') return callback(null, true);
      
      fs.writeFile(outputFile, buffers, function(err) {
        if (err) return callback(err);        
        // console.log(buffers);
        /*if (self.packageManager.enableMinify) {
          exec("java -jar " + path.join(__dirname, '../', "bin/yuicompressor-2.4.7.jar") + " " + outputFile + " -o " + outputFile, function(err, stdout, stderr) {
            if (err) return callback(err);
            if (stderr) return callback(stderr);
            
            console.log('[PRODUCTION] template minified ' + outputFile);
                        
            callback(null, true);
          });
        } else {
          callback(null, true);
        }*/
        callback(null, true);
      });
    });
        
  };
  
}();

DistInfo.prototype.constructor = DistInfo;
  
// ===================
// = PACKAGE MANAGER =
// ===================

var packageManager = new function() {  
  this.packages = [];
  this.distributions = [];
  this.runnerServer = null;
  
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
    options = options || {};
    options.packageManager = this;
    
    var distInfo = new DistInfo(options);
    
    // Reference which distribution info belong the package.
    distInfo.packages.forEach(function(pack) {
      pack.distInfo = distInfo;
    });
    
    this.distributions.push(distInfo);
  };
  
  this.build = function(callback) {
    //console.log('Packages to Build: ' + this.packages.length);    
    async.eachSeries(this.packages, function(pack, inlineCallback) {
      pack.build(inlineCallback);
    }, callback);
  };
  
  this.watchForChanges = function(callback) {
    async.eachSeries(this.packages, function(pack, inlineCallback) {
      pack.watchForChanges(inlineCallback);
    }, function(err) {
      return callback(err);
    });
  };
  
  this.retrievePackage = function(packageName) {
    var found = null;
    this.packages.forEach(function(package) {
      if (package.name == packageName) found = package;
    });
    return found;
  };
  
  this.retrieveDistribution = function(distributionName) {
    var found = null;
    this.distributions.forEach(function(distribution) {
      if (distribution.name == distributionName) found = distribution;
    });
    return found;
  };
  
  this.runServer = function(options, callback) {
    this.runnerServer = new RunnerServer(options);    
    this.runnerServer.run(callback);
  };
  
}();

module.exports = packageManager;