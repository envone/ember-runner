var async = require('async'),
    runner;

var Task = function () {
  this.constructor.prototype.initialize.apply(this, arguments);
};

Task.prototype = new function () {
  
  this.initialize = function(name, description, dependencies, action) {
    this.name = name;
    this.description = description;
    this.dependencies = dependencies;
    this.action = action;
    
    if (this.action === undefined) {
      this.dependencies = null;
      this.action = dependencies;
    }    
  };
  
  this.invoke = function(callback) {
    runner.runTask(this, callback);
  };
  
}();
Task.prototype.constructor = Task;

runner = new function() {
  this.tasks = {};

  this.task = function(name, description, dependencies, action) {
    this.tasks[name] = new Task(name, description, dependencies, action);
  };
  
  this.invoke = function(task, callback) {
    if (task === undefined) task = 'default';
    
    task = this.tasks[task];
    
    if (task) {
      task.invoke(callback);
    } else {
      throw "Task not found: " + task;
    }
  };
  
  this.runTask = function(task, callback) {
    var dependencies = task.dependencies,
        tasks = this.tasks,
        taskActions = [],
        self = this,
        dependencyTask;
    
    // Check if tash has dependencies
    if (dependencies && dependencies.length > 0) {
      // create an array of taskActions to pass to the async
      dependencies.forEach(function(newTask) {
        dependencyTask = tasks[newTask];        
        if (!dependencyTask) throw "Depedency task '" + newTask + "' not found for task: '" + task.name + "'";        
        taskActions.push(dependencyTask);
      });
      
      async.forEachSeries(taskActions, function(taskItem, inlineCallback) {
        taskItem.invoke(inlineCallback);
      }, function(err, success) {
        if (err) return console.log(err);
        
        self.displayTask(task);
        task.action.apply(task, [callback]);
      });
    } else {
      self.displayTask(task);
      task.action.apply(task, [callback]);
    }
  };
  
  this.displayTask = function(task) {
    console.log('['+ task.name +'] Started');
  };
  
}();

//console.log(runner);
runner.Task = Task;

module.exports = runner;
