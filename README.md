# Introducing ember-runner

# Handlers
The handlers are common action that you need to chain to transform a source file to a distributable one, for example an style file with .less extension will be transformed to a .css, and then minify to reduce the unrequired space, so will be ready for use in your deployed app.

## Published Handlers

- **encloseExportFunction**: For each file enclouse to be ready for use in yout browser
- **includeTemplate**: Add .handlebars file to Ember.TEMPLATES collection, so your view can found it.
- **removeRequires**: This handlers removes all require('*') found in each .js scripts.

## Comming Handlers

- **less**: Transform your less style to css
- **stylus**: Transform your less style to css
- **uglify-js**: Minifies your script

# Starting with ember-runner

## Installation

``` javascript
npm install -g ember-runner
```

## Run

In your EmberJS root directory run to run a preview develpment server

``` javascript
ember-runner
```