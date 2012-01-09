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
      
      if (pending === 0) return done(null, results);
      
      cleanList.forEach(function(file) {
        file = dir + '/' + file;
        fs.lstat(file, function(err, stat) {
          if (stat && stat.isDirectory()) {
            results.dirs.push(new File({
              path: file,
              package: options.package,
              isDirectory: true
            }));
            
            helpers.walk(file, options, function(err, res) {
              results.dirs = results.dirs.concat(res.dirs);
              results.files = results.files.concat(res.files);
              
              if (--pending === 0) done(null, results);
            });
          } else {
            results.files.push(new File({
              path: file,
              package: options.package
            }));
            
            if (--pending === 0) done(null, results);
          }
        });
      });
    });
    
  };
  
  this.watchDirectoriesTree = function(directories, callback) {
    var pending = directories.length;
    
    directories.forEach(function(dir) {
      fs.watch(dir.path, function(evt, filename) {
        callback(false, dir, evt);
      });
    });
    
    // (firstTime, dir, curr, prev)
    callback(true, null, null);
  };
  
  this.watchTree = function(files, callback) {
    if ("string" === typeof files) {
      files = [files];
    }
    
    var pending = files.length;
    
    files.forEach(function(file) {
      fs.watchFile(file.path, function (curr, prev) {
        callback(false, file, curr, prev);
      });
    });
    
    // (firstTime, file, curr, prev)
    callback(true, null, null, null);
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
  
}();

module.exports = helpers;