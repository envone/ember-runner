var File = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

File.prototype = new function () {
  
  this.initialize = function(options) {
    console.log(options);
  };  
  
}();

File.prototype.constructor = File;

module.exports = File;