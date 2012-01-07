var fs = require('fs'),
    path = require('path');

var File = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

File.prototype = new function () {
  
  this.initialize = function(options) {
    var key;
    
    for(key in options) {
      this[key] = options[key];
    }
    
    // Check for extname
    this.extname = path.extname(this.path);
    
    // Build url path
    var pack = this.package;
    
    if (pack && this.isScript()) {
      // remove path
      this.url = this.path.replace(pack.path + "/" + pack.scripts, '');
      // remove extension
      this.url = this.url.replace(this.extname, '');
      // add package name
      this.url = pack.name + this.url;
    }
  };
  
  this.isStylesheet = function() {
    return /^\.(css|less|scss)$/.test(this.extname);
  };

  this.isScript = function() {
    return this.extname === '.js';
    // && !/tests\//.test(this.path);
  };
  
  this.isTemplate = function() {
    return /^\.(hbs|handlebars)$/.test(this.extname);
  };
  
  this.readFile = function(callback) {
    fs.readFile(this.path, 'utf8', function(err, data) {
      if (err) return callback("Error loading file: " + this.path);
      this.content = data;
      callback(null, data);
    });
  };
  
}();

File.prototype.constructor = File;

module.exports = File;