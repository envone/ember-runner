var async = require('async'),
    less = require('less'),
    stylus = require('stylus'),
    nib = require('nib'),
    vm = require('vm');

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

handlersManager.add("removeRequires", function(context, callback) {
  var regexp = new RegExp("require\\([\"']([a-zA-Z_\\-\\/]*)[\"']\\)\\;", "g"),
      matches = [], match, buffer;
  
  buffer = context.buffer;
  
  while(match = regexp.exec(buffer)) {
    matches.push(match[0]);    
  }
  
  matches.forEach(function(match) {
    buffer = buffer.replace(match, '');
  });
  
  context.buffer = buffer;
  
  callback(null, context);
});

handlersManager.add("removeAssertions", function(context, callback) {
  var regexp = new RegExp("^(\\s)*Ember\\.(assert|deprecate|warn)\\((.*)\\).*$}", "g"),
      matches = [], match, buffer;
  
  buffer = context.buffer;
  
  while(match = regexp.exec(buffer)) {
    matches.push(match[0]);    
  }
  
  matches.forEach(function(match) {
    buffer = buffer.replace(match, '');
  });
  
  context.buffer = buffer;  
  callback(null, context);
});

handlersManager.add("encloseExportFunction", function(context, callback) {
  context.buffer = "(function(exports) {" + context.buffer + "\n})({});";  
  callback(null, context);
});

handlersManager.add("includeTemplate", function(context, callback) {
  context.buffer = context.buffer.replace(/\r?\n|\r/g, '');

  // RCP TODO: How do we access the values from the ember_runner_configdown here?
  //           We want to pass in the value of config.apps.templates to the File.templateName method

  // RCP BEGIN TEMPORARY
  var emberRunnerConfigAppsTemplateValue = 'templates';
  // RCP END TEMPORARY

  context.buffer = "\nEmber.TEMPLATES['" + context.file.templateName(emberRunnerConfigAppsTemplateValue) + "'] = Ember.Handlebars.compile('" + context.buffer + "');\n";
  callback(null, context);
});

// =========================
// = PRECOMPLIED TEMPLATES =
// =========================

//dummy jQuery
var jQuery = function() { return jQuery; };
jQuery.ready = function() { return jQuery; };
jQuery.inArray = function() { return jQuery; };
jQuery.fn = {};
jQuery.jquery = "1.7.1";

//var navigator = function() { return navigator; };
//navigator.userAgent = 'nodejs';

//dummy DOM element
var element = {
  firstChild: function () { return element; },
  innerHTML: function () { return element; }
};

var sandbox = {
  // DOM
  document: {
    createRange: false,
    createElement: function() { return element; }
  },

  // Console
  console: console,

  // jQuery
  jQuery: jQuery,
  $: jQuery,
  
  navigator: {
    userAgent: 'nodejs'
  },
  
  // handlebars template to compile
  template: null,

  // compiled handlebars template
  templatejs: null
};

handlersManager.add("includeCompiledTemplate", function(context, callback) {
  var sandBoxContext, deps = context.dependencies;
  
  // add template to sandbox
  sandbox.template = context.buffer;
  
  // window
  sandbox.window = sandbox;
  sandbox.navigator = {
    userAgent: 'nodejs'
  };
  
  // create a context for the vm using the sandbox data
  sandBoxContext = vm.createContext(sandbox);
  
  for(var dep in deps) {
    // load Ember into the sandbox
    vm.runInContext(deps[dep], sandBoxContext, dep);    
  }
  
  // load Ember into the sandbox
  // vm.runInContext(emberjs, sandBoxContext, 'ember.js');
  console.log('--> ' + context.file.name);
  
  // compile the handlebars template inside the vm context
  vm.runInContext('templatejs = Ember.Handlebars.precompile(template).toString();', sandBoxContext);  

  // RCP TODO: How do we access the values from the ember_runner_configdown here?
  //           We want to pass in the value of config.apps.templates to the File.templateName method

  // RCP BEGIN TEMPORARY
  var emberRunnerConfigAppsTemplateValue = 'templates';
  // RCP END TEMPORARY

  context.buffer = "\nEmber.TEMPLATES['" + context.file.templateName(emberRunnerConfigAppsTemplateValue) + "'] = Handlebars.template(" + sandBoxContext.templatejs + ");\n";
  
  callback(null, context);
});

// =======================
// = STYLESHEET HANDLERS =
// =======================

// This handlers is only to allow process, but do nothing.
handlersManager.add("css", function(context, callback) {
  callback(null, context);
});

handlersManager.add("less", function(context, callback) {
  less.render(context.buffer, function(err, css) {
    context.buffer = css;
    callback(null, context);
  });
});

// [TODO] Will be implemented
handlersManager.add("scss", function(context, callback) {
  context.buffer = "\n/* [SORRY] " + context.file.name + context.file.extname + " not generated, scss is not currently supported. */\n";
  callback(null, context);
});

// ==========
// = Stylus =
// ==========

handlersManager.add("styl", function(context, callback) {  
  stylus(context.buffer).use(nib()).render(function(err, css) {
    if (err) {
      context.buffer = "\\/* [LESS: ERROR] " + context.file.name + context.file.extname + " not generated, cause: \n" + err + "*\\/";
      console.log(context.buffer);
    } else {
      context.buffer = css;
    }
      
    callback(null, context);
  });
});