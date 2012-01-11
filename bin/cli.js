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

client.command('preview')
      .description('Run ember-runner server in debug mode, scripts are not minified.')
      .option('-t, --test', 'Also run tests')
      .action(function(env, options) {
        invoked = true;
        runner.invoke("preview", function(err, success) {
          if (err) return console.log('Task finished with errors');
          console.log('-- Task finished succesfully');
          console.log('ember-runner [' + pkg.version + '] Running in preview mode.');
        });
      });

client.command('production')
      .description('Run ember-runner in production mode, scripts are minified. (Coming soon)')
      .option('-t, --test', 'Also run tests')
      .action(function(env, options) {
        invoked = true;
        pm.enableMinify = true;
        runner.invoke("preview", function(err, success) {
          if (err) return console.log('Task finished with errors');
          console.log('-- Task finished succesfully');
          console.log('ember-runner [' + pkg.version + '] Running in production mode.');
        });
      });

client.command('generator')
      .description('ember-runner code generator, to quickling create templates of common files and patterns')
      .action(function(env, options) {
        invoked = true;
        console.log('ember-runner [' + pkg.version + '] Generator (Coming Soon).');
      });

client.parse(args);

if (!invoked) console.log('[ember-runner] type -h for instructions.');