var express = require('express'),
    http = require('http'),
    httpProxy = require('http-proxy'),
    workDir = process.cwd();

var RunnerServer = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

var proxyError = '[Proxy] There was an error proxying your request, Maybe client server was restarted...';

RunnerServer.prototype = new function () {
  
  // When changes are made, we put a quere of files changes
  // When length === 0, server are ready, else server is pending of changes
  this.changesQueue = [];
  this.nextRequest = null;
  
  this.initialize = function(options) {
    this.options = options;
    
    // Build app server
    this.createAppServer();
  };
  
  this.run = function(callback) {
    this.server.listen(this.options.port);   

    callback(null, true);
  };
    
  this.createAppServer = function() {
    var options = this.options,
        target = 'http://' + options.proxy.host + ':' + options.proxy.port,
        proxy = httpProxy.createProxyServer({
          target: target
        }),        
        self = this, app;
    
    app = this.appServer = express();

    this.server = http.createServer(app);

    this.server.on('upgrade', function(req, socket, head) {
      // Proxy websocket requests too
      proxy.ws(req, socket, head, function (err) {
        console.log(proxyError);
        // Now you can get the err
        // and handle it by your self
        // if (err) throw err;
        socket.close();
      });
    });

    // Proxy request if proxy is available
    app.use(function(req, res, next) {
      var url = req.url, 
          prefix = new RegExp(options.proxy.prefix);

      if (options.proxy.useProxy && url.match(prefix)) {
        proxy.web(req, res, function(err) {
          console.log(proxyError);
          res.writeHead(502);
          res.end(proxyError);
        });
      } else {
        // If queue is empty, send response right now
        if (self.changesQueue.length === 0) next();
        // else, store the next step so we call it when ready.
        else self.nextRequest = next;
      }
    });

    app.use(express.static(workDir + '/public'));    
  };
  
  this.addToQueue = function(f) {
    var q = this.changesQueue;
    
    console.log('added to server queue: ' + f);
    
    q.push(f);
  };
  
  this.removeFromQueue = function(f) {
    var q = this.changesQueue;
    
    // remove it from queue
    q.splice(q.indexOf(f), 1);
    
    console.log('removed to server queue: ' + f);
    
    // Check if queue is equal to 0 and we have an nextRequest
    if (q.length === 0 && this.nextRequest) this.nextRequest();
  };

}();

RunnerServer.prototype.constructor = RunnerServer;

module.exports = RunnerServer;