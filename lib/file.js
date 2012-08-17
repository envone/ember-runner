var fs = require('fs'),
    fileQueue = require('./file_queue'),
    path = require('path');

var File = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

File.prototype = new function () {
  
  this.initialize = function(options) {
    var key, name;
    
    for(key in options) {
      this[key] = options[key];
    }
    
    // Check for extname
    this.extname = path.extname(this.path);

    // Create name
    name = this.path.split('/');
    this.fullName = name = name[name.length - 1]; // full name
    name = name.replace(this.extname, '');
    
    // Store the name
    this.name = name;
    
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
    return /^\.(css|less|scss|styl)$/.test(this.extname);
  };

  this.isScript = function() {
    return this.extname === '.js' && !/tests\//.test(this.path);
  };
  
  this.isTest = function() {
    return this.extname() === '.js' && /tests\//.test(this.path);
  };
  
  this.isTemplate = function() {
    return /^\.(hbs|handlebars)$/.test(this.extname);
  };
  
  this.isStatic = function() {
    return /^\.(html|html)$/.test(this.extname);
  };
  
  this.readFile = function(callback) {
    var self = this;

    fileQueue.readFile(this.path, function(err, data) {
      if (err) {
        console.log(err);
        return callback("Error loading file: " + this.path);
      }
      self.content = data;
      callback(null, data);
    });
  };
  

  // `templateName( templatesLocation )` returns the fully computed name of the template, taking into
  //  account any nested subfolders.
  //
  //   * `templatesLocation` is expected to be the value of the configured templates location
  //
  // `return` The fully computed name of the template
  this.templateName = function(templatesLocation) {
    var templateName = null;

    if (this.isTemplate()) {
      var pathComponents = this.path.split('/');

      // Drop the extension on the final component...
      pathComponents[pathComponents.length - 1] = pathComponents[pathComponents.length - 1].replace(this.extname, '');

      for (i = pathComponents.length - 1; i >= 0; i--){
        if (pathComponents[i] === templatesLocation) {

          for (j = i + 1; j < pathComponents.length; j++) {
            if (templateName === null) {
              templateName = pathComponents[j];
            } else {
              templateName = templateName + '/' + pathComponents[j];
            }
          }

          break;
        }
      }
    }

    return templateName;
  };

}();

File.prototype.constructor = File;

module.exports = File;