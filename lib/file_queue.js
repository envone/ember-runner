var fs = require('fs'),
    path = require('path');

var FileQueue = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

FileQueue.prototype = new function () {
  this.queue = [];
  this.openedFiles = 0;
  this.maxFilesOpen = 100; // for now the limit is hard coded.
  
  this.initialize = function(options) {    
  };
  
  this.queueFile = function(readInfo) {
    this.queue.push(readInfo);
    this.processFile();
  };
  
  this.processFile = function() {
    var file, readInfo, self = this;

    if (this.queue.length > 0 && this.openedFiles < this.maxFilesOpen) {
      this.openedFiles += 1;
      readInfo = this.queue.shift();

      fs.readFile(readInfo[0], 'utf8', function(err, data) {
        readInfo[1](err, data);
        self.openedFiles -= 1;
        self.processFile();
      });
    }
  };
  
  this.readFile = function(file, callback) {
    this.queueFile([file, callback]);
  };
  
}();

FileQueue.prototype.constructor = FileQueue;

module.exports = new FileQueue();