var Package = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

Package.prototype = new function () {
  
  this.initialize = function(options) {
    console.log(options);
  };
  
  this.computeDependencies = function(files, callback) {
    
  };
  
  this.sortDependencies = function(file, orderedFiles, files, recursionHistory) {
    
  };
  
  this.orderScripts = function(scripts, callback) {
    
  };
  
  this.filterFiles = function(files, package, callback) {
    
  };
  
  this.build = function(scripts, callback) {
    
  };
  
}();

Package.prototype.constructor = Package;

var packageManager = new function() {
  
  this.createPackage = function(options) {
    var pack = new Package(options);
  };
  
}();

module.exports = packageManager;