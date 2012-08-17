# Introducing ember-runner
This build tool is for the crazy ones that loves Node.JS and EmberJS, and for these one that loves simplicty too. In an clean and easy way you can run a preview of your application instantly in production mode or by previewing a development mode that you can debug your files more easily.

## Some of the features you will love are:
- **Preview Mode**: Run your application in preview mode so you can debug it.
- **Production Mode**: Run in production mode, so you can test performance, files sizes and so on.
- **Generator**: Will generate files for you with the ``-g`` flag. (Coming soon)
- **Auto-Deploy**: Generates the required libraries, styles, and templates on the fly after you save the file
- **Proxy**: Allow you to call your backend without tricks.
- **Build Distributions**: You can manage how the scripts are concatenated to generate a script, for example now you can join your ember.js with your frameworks to generate only one file.
- **Run more that one application at once**

## How it works
The idea is to apply best practices we have learned over time, and we found that we separate these sripts that belong to an application and other than belong to a framework, and each one manages common resouces that will be separated to identify them easily, the following is the idea of the structure of work that is inspired by this tool:

```
- <your project>
  - <apps>
    - <appA>
      - <css>
      - <js>
      - <templates>
      - <static>
    - <appA>
      - <css>
      - <js>
      - <templates>
      - <static>
  - <public>
      - <apps>
      - <libraries>
      index.html
  - <vendors/frameworks>
    - <ember.js>
    - <ember-data>
    - <ember-touch>
    - <ember-routing>
    - <your framework A>
    - <your framework B>
```
**[PLEASE NOTE]**: Don't add manually files in public/apps (apps.output) and public/libraries (vendors/output), these folders are deleted each time you start the server.

# Handlers
The handlers are common action that you need to chain to transform a source file to a distributable one, for example an style file with .less extension will be transformed to a .css, and then minify to reduce the unrequired space, so will be ready for use in your deployed app.

## Published Handlers

- **encloseExportFunction**: For each file enclose to be ready for use in your browser
- **includeTemplate**: Add .handlebars file to Ember.TEMPLATES collection, so your view can find it.
- **removeRequires**: This handlers removes all require('*') found in each .js scripts.
- **less**: Transform your less style to css

## Comming Handlers

- **stylus**: Transform your less style to css
- **uglify-css**: Minifies your stylesheet
- **uglify-js**: Minifies your script
- **jslint**: Check you javascript with jslint to check for inconsistencies.
- **spriteImages**: Concatenates images to save spaces and the number of request when fetching resources.

# Starting with ember-runner

## Installation

``` javascript
npm install -g ember-runner
```

## Additional steps (these step will be done with generators in the future):

### Create an empty ember_runner_config.json

```
{}
```
### Clone ember.js in vendors

```
git submodule add https://github.com/emberjs/ember.js.git vendors/ember.js
```

### Add your app:

Create your application with a main.js as follow:

```
<root>
  <myapp>
    <css>
      default.styl
    <js>
      main.js      
````

### Then the last step is to add myapp.html in the public folder with these scripts:

```
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js"></script>
<script>!window.jQuery && document.write(unescape('%3Cscript%20src%3D%22http%3A%2F%2Flocalhost%3A9292%2Fjs%2Flibs%2Fjquery-1.6.1.min.js%22%3E%3C%2Fscript%3E'))</script>    
<script type="text/javascript" src="libraries/ember.js"></script>
<script type="text/javascript" src="apps/myqpp/myapp_templates.js"></script>
<script type="text/javascript" src="apps/myapp/myapp.js"></script>
```

## Run

In your EmberJS root directory run to run a preview develpment server

``` javascript
ember-runner preview
```
# Configuring ember_runner_config

By default the configuration file is like above, you can just overide only these keys that you need to acommodate for your project.

```
{
  
  "apps": { 
    "input": "apps",
    "styles": "css",
    "static": "static",
    "templates": "templates",
    "scripts": "js",
    "output": "public/apps"
  },
  
  "vendors": {
    "input": "vendors",
    "distributions": {
      "ember": ["ember.js/packages/handlebars", "ember.js/packages/ember-metal", "ember.js/packages/ember-runtime", "ember.js/packages/ember-views", "ember.js/packages/ember-states", "ember.js/packages/metamorph", "ember.js/packages/ember-handlebars"]
    },
    "styles": "css",
    "static": "static",
    "templates": "templates",
    "scripts": "lib",
    "output": "public/libraries"
  },
    
  "server": {
    "static": "public",
    "port": "3000",
    "proxy": {
      "useProxy": false,
      "host": "localhost",
      "port": 3101,
      "prefix": "^\/backend"
    }
  }
  
}
```

For example, if you need to add your frameworks and addons to the list of distributions in vendors, you can configure the ember_runner_config as:

```
{
  
  "vendors": {
    "distributions": {
      "addons": ["sproutcore-datastore/packages/sproutcore-indexset", "sproutcore-datastore/packages/sproutcore-datastore", "sproutcore-routing", "sproutcore-statechart", "sproutcore-touch/packages/sproutcore-touch"],
      "shared": ["envone-core", "envone-desktop-ui", "envone-desktop", "business-core"]      
    }
  },
  
  "server": {
    "proxy": {
      "useProxy": true
    }
  }
  
}
```

Also note that you can useProxy by enabling it and add host and port if are differents.