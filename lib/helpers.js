var fs = require('fs'),
    File = require('./file'),
    path = require('path');

var helpers = new function() {

  this.walk = function(dir, aditionalOptions, done) {
    var results = {
      dirs: [],
      files: []
    };
    
    var options = {
      ignoreDotFiles: true,
      ignoreTestsFiles: true,
      ignoreTmpsFiles: true
    };
    
    if (done === undefined) {
      done = aditionalOptions;
      aditionalOptions = undefined;
    }
    
    // Merge aditional options with options
    if (aditionalOptions) {
      for(var key in aditionalOptions) {
        options[key] = aditionalOptions[key];
      }
    }
    
    fs.readdir(dir, function(err, list) {
      var cleanList = [], exclude;
      
      if (err) return done(err);
      
      // remove unneeded files
      list.forEach(function(file) {
        exclude = false;        
        
        if (options.ignoreDotFiles && file.match(/(.git|.sass|.bpm|.DS_Store)/)) exclude = true;
        if (options.ignoreTestsFiles && file.match(/test/)) exclude = true;
        if (options.ignoreTmpsFiles && file.match(/(tmp|tmps|Gemfile|VERSION|README|Rake)/)) exclude = true;
        if (file.match(/\.md$/)) exclude = true;
        
        if (!exclude) cleanList.push(file);
      });
      
      var pending = cleanList.length;
      
      if (!pending) return done(null, results);
      cleanList.forEach(function(file) {
        file = dir + '/' + file;
        fs.lstat(file, function(err, stat) {
          if (stat && stat.isDirectory()) {
            helpers.walk(file, options, function(err, res) {
              //results = results.concat(res);
              results.dirs = results.dirs.concat(res.dirs);
              results.files = results.files.concat(res.files);
              
              if (!--pending) done(null, results);
            });
          } else {
            //results.files.push(file);
            results.files.push(new File({
              path: file,
              package: options.package
            }));
            if (!--pending) done(null, results);
          }
        });
      });
    });
    
  };
  
  this.watchTree = function(files, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }
    
    var fileWatcher = function (f) {
      fs.watchFile(f, options, function (c, p) {
      // Check if anything actually changed in stat
      if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() == c.mtime.getTime()) return;
        files[f] = c;
        
        if (!files[f].isDirectory()) {
          callback(f, c, p);
        } else {
          fs.readdir(f, function (err, nfiles) {
            if (err) return;
            
            nfiles.forEach(function (b) {
              var file = path.join(f, b);
              if (!files[file]) {
                fs.stat(file, function (err, stat) {
                  callback(file, stat, null);
                  files[file] = stat;
                  fileWatcher(file);
                });
              }
            });
          });
        }
        
        if (c.nlink === 0) {
          // unwatch removed files.
          delete files[f];
          fs.unwatchFile(f);
        }
      });
    };

    for (var i in files) {
      fileWatcher(i);
    }
    
    callback(files, null, null);
  };
  
  this.mkdir_p = function(path, mode, callback, position) {
    var self = this, parts;
    
    mode = mode || 0777;
    position = position || 0;
    parts = require('path').normalize(path).split('/');

    if (position >= parts.length) {
      if (callback) {
        return callback();
      } else {
        return true;
      }
    }

    var directory = parts.slice(0, position + 1).join('/');
    fs.stat(directory, function(err) {
      if (err === null) {
        self.mkdir_p(path, mode, callback, position + 1);
      } else {
        fs.mkdir(directory, mode, function (err) {
          if (err) {
            if (callback) {
              return callback(err);
            } else {
              throw err;
            }
          } else {
            self.mkdir_p(path, mode, callback, position + 1);
          }
        });
      }
    });
  };
  
  /*
  function mkdir_p(path, mode, callback, position) {
      mode = mode || 0777;
      position = position || 0;
      parts = require('path').normalize(path).split('/');

      if (position >= parts.length) {
          if (callback) {
              return callback();
          } else {
              return true;
          }
      }

      var directory = parts.slice(0, position + 1).join('/');
      fs.stat(directory, function(err) {
          if (err === null) {
              mkdir_p(path, mode, callback, position + 1);
          } else {
              fs.mkdir(directory, mode, function (err) {
                  if (err) {
                      if (callback) {
                          return callback(err);
                      } else {
                          throw err;
                      }
                  } else {
                      mkdir_p(path, mode, callback, position + 1);
                  }
              })
          }
      })
  }
  */
  
}();

module.exports = helpers;