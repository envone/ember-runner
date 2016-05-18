#!/usr/bin/env node

var er = require('../'),
    fs = require('fs'),
    runner = require('../lib/runner'),
    pm = require('../lib/packages'),    
    client = require('commander'),
    args = process.argv,
    workDir = process.cwd(),
    invoked = false,
    pkg = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString());

client.version(pkg.version);

client.command('preview')
      .description('Run ember-runner server in debug mode, scripts are not minified.')
      .option('-t, --test', 'Also run tests')
      .action(function(env, options) {
        invoked = true;
        runner.invoke("preview", function(err, buildInfo) {
          if (err) return console.log('Task finished with errors', err);
          console.log('-- Task finished succesfully');
          console.log('ember-runner [' + pkg.version + '] Running in preview mode on port: ' + buildInfo.server.port + '.');
        });
      });

client.command('production')
      .description('Run ember-runner in production mode, scripts are minified. (Coming soon)')
      .option('-t, --test', 'Also run tests')
      .action(function(env, options) {
        invoked = true;
        pm.enableMinify = true;
        pm.enableTemplatePrecompilation = true;
        runner.invoke("preview", function(err, buildInfo) {
          if (err) return console.log('Task finished with errors', err);
          console.log('-- Task finished succesfully');
          console.log('ember-runner [' + pkg.version + '] Running in production mode on port: ' + buildInfo.server.port + '.');
        });
      });

client.command('dist')
      .description('Run ember-runner to generate disrtibution libraries for production mode, scripts are minified.')
      .option('-t, --test', 'Also run tests')
      .action(function(env, options) {
        invoked = true;
        pm.enableMinify = true;
        pm.enableTemplatePrecompilation = true;
        runner.invoke("dist", function(err, buildInfo) {
          if (err) return console.log('Task finished with errors', err);
          console.log('-- Task finished succesfully');
          console.log('ember-runner [' + pkg.version + '] distribution generated.');
        });
      });

client.command('generator')
      .description('ember-runner code generator, to quickly create templates of common files and patterns')
      .action(function(env, options) {
        invoked = true;
        console.log('ember-runner [' + pkg.version + '] Generator (Coming Soon).');
      });

client.parse(args);

if (!invoked) console.log('[ember-runner] type -h for instructions.');