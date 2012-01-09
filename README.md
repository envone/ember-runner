# Introducing ember-runner

# Handlers
The handlers are common action that you need to chain to transform a source file to a distributable one, for example an style file with .less extension will be transformed to a .css, and then minify to reduce the unrequired space, so will be ready for use in your deployed app.

## Published Handlers

- **removeRequires**: This handlers removes all require('%@') found un each .js scripts.

## Comming Handlers

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