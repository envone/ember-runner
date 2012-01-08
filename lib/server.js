var express = require('express'),
    httpProxy = require('http-proxy'),
    workDir = process.cwd();

var RunnerServer = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

RunnerServer.prototype = new function () {
  
  this.initialize = function(options) {
    this.options = options;
    
    // Build app server
    this.createAppServer();
  };
  
  this.run = function(callback) {
    this.appServer.listen(this.options.port);
    this.appServer.use(express.static(workDir + '/public'));
  };
    
  this.createAppServer = function() {
    var options = this.options,
        proxy = new httpProxy.RoutingProxy();
    
    this.appServer = express.createServer(function(req, res, next) {
      var url = req.url, 
          prefix = new RegExp(options.proxy.prefix);

      if (options.proxy.useProxy && url.match(prefix)) {
        proxy.proxyRequest(req, res, {
          host: options.proxy.host,
          port: options.proxy.port,
          buffer: proxy.buffer(req)
        });
      } else {
        next();        
      }
      
    });
    
  };

}();

RunnerServer.prototype.constructor = RunnerServer;

module.exports = RunnerServer;