If you fork and install ember-runner in your local disk, you
have two ways to run your local copy

1. sudo vi /usr/local/bin/ember-local
2. on vi add: 'node {path_to_local_ember_runner}/ember-runner/bin/cli.js'
3. sudo chmod +x /usr/local/bin/ember-local

Or if you use nvm, you can follow these steps:

1. cd {path_to_nvm}/v0.8.14/bin (by doing 'which node')
2. ln -s {path_to_local_ember_runner}/bin/cli.js ember-local

And then run 'ember-local preview' or 'ember-local production'.