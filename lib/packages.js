var async = require('async');

var Package = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

Package.prototype = new function () {
  
  this.initialize = function(options) {
    var key;
    
    for(key in options) {
      this[key] = options[key];
    }
  };
  
  this.build = function(callback) {
    console.log('[Build] Package: ' + this.name);
    callback(null, true);
  };
  
  this.watchForChanges = function(callback) {
    
  };
  
  // ===========
  // = Scripts =
  // ===========
  
  this.computeDependencies = function(files, callback) {
    
  };
  
  this.sortDependencies = function(file, orderedFiles, files, recursionHistory) {
    
  };
  
  this.orderScripts = function(scripts, callback) {
    
  };
  
  this.scanFiles = function(files, package, callback) {
    
  };
  
  this.buildScripts = function() {
    
  };
  
  // =========
  // = Styles =
  // =========
  
  this.buildStyles = function() {
    
  };
  
  // ==========================
  // = Templates / Handlebars =
  // ==========================
  
  this.buildTemplates = function() {
    
  };
  
}();

Package.prototype.constructor = Package;

var packageManager = new function() {  
  this.packages = [];
  
  this.createPackage = function(options) {
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
  
}();

module.exports = packageManager;