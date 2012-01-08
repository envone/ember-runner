var async = require('async');

var handlersManager = new function() {
  this.handlers = {};
  
  this.add = function(name, handler) {
    this.handlers[name] = handler;
  };
  
  this.retrieveHandlers = function(selectedHandlers) {
    var handlers = [],
        handler, i;

    for(i = 0; i < selectedHandlers.length; i++ ) {
      handler = selectedHandlers[i];
      handlers.push(this.handlers[handler]);
    }
    
    return handlers;
  };
  
  this.run = function(starter, selectedHandlers, callback) {
    var handlers = [starter].concat(this.retrieveHandlers(selectedHandlers));    
    async.waterfall(handlers, callback);
  };
  
}();

module.exports = handlersManager;

// ============
// = HANDLERS =
// ============

handlersManager.add("removeRequires", function(buffer, callback) {
  var regexp = new RegExp("require\\([\"']([a-zA-Z_\\-\\/]*)[\"']\\)\\;", "g"),
      matches = [], match;
  
  while(match = regexp.exec(buffer)) {
    matches.push(match[0]);    
  }
  
  matches.forEach(function(match) {
    buffer = buffer.replace(match, '');
  });
  
  callback(null, buffer);
});

handlersManager.add("encloseExportFunction", function(buffer, callback) {
  buffer = "\n(function(exports) {\n" + buffer + "\n})({});\n";
  callback(null, buffer);
});