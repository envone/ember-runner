var fs = require('fs');

var helpers = new function() {

  this.walk = function(dir, options, done) {
    var results = {
      dirs: [],
      files: []
    };
    
    if (done === undefined) {
      done = options;
      options = undefined;
    }
    
    // Default behaviour
    if (options === undefined) {
      options = {
        ignoreDotFiles: true,
        ignoreTestsFiles: true,
        ignoreTmpsFiles: true
      };
    }
        
    fs.readdir(dir, function(err, list) {
      var cleanList = [], exclude;
      
      if (err) return done(err);
      
      // remove unneeded files
      list.forEach(function(file) {
        exclude = false;        
        
        if (options.ignoreDotFiles && file.match(/(.git|.sass|.bpm|.DS_Store)/)) exclude = true;
        if (options.ignoreTestsFiles && file.match(/test/)) exclude = true;
        if (options.ignoreTmpsFiles && file.match(/(tmp|tmps)/)) exclude = true;
        
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
            results.files.push(file);
            if (!--pending) done(null, results);
          }
        });
      });
    });
    
  };
  
}();

module.exports = helpers;