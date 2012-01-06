var //connect = require('connect'),
    express = require('express'),
    httpProxy = require('http-proxy'),
    proxy = new httpProxy.HttpProxy(),
    workDir = process.cwd(),
    appRunnerServer, proxyRunnerServer;
/*    
appRunnerServer = express.createRunnerServer();

proxyRunnerServer = express.createRunnerServer(function(req, res) {
  var url = req.url;

  if (url.match(/^\/backend/)) {
    // Backend
    console.log('[PROXY] [BACKEND] ' + url);    
    proxy.proxyRequest(req, res, {
      host: 'localhost',
      port: 3101,
      buffer: proxy.buffer(req)
    });
  } else {
    // Frontend
    proxy.proxyRequest(req, res, {
      host: 'localhost',
      port: 4020,
      buffer: proxy.buffer(req)
    });
  }
});
*/

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
    var options = this.options;
    
    this.appServer = express.createServer(function(req, res, next) {
      var url = req.url;

      if (options.proxy.useProxy && url.match(/^\/backend/)) {
        console.log('[PROXY] [BACKEND] ' + url);    
        proxy.proxyRequest(req, res, {
          host: 'localhost',
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