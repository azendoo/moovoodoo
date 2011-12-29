window.addEvent('domready',function(){


var App = {};
App.Model = App.Collection = App.Controller = {};

App.Model.Todo = new Class({
  
  Extends: Moovoodoo.Model,

  localStore: new Store("todos"),

  sync: Moovoodoo.sync.LocalStore,

  defaults: {
    content: "empty todo...",
    done: false
  },

  initialize: function(attributes, options){
    this.parent(attributes, options);
    if (!this.get("content")) {
      this.set({"content": this.defaults.content});
    }
  },

  toggle: function() {
    this.save({done: !this.get("done")});
  },

  clear: function() {
    this.destroy();
    this.view.remove();
  }
});

App.Collection.TodoList = new Class({
  
  Extends: Moovoodoo.Collection,

  model: App.Model.Todo,

  localStore: new Store("todos"),

  sync: Moovoodoo.sync.LocalStore,

  done: function() {
    return this.filter(function(todo){ return todo.get('done'); });
  },

  remaining: function() {
    return this.without.apply(this, this.done());
  }

});

window.Todos = new App.Collection.TodoList();

App.Controller.Todo = new Class({
  
  Extends: Moovoodoo.Controller,

  tagName : 'li',

  template: _.template(document.getElement('#item-template').get('html')),

  events: {
    "click .check"              : "toggleDone",
    "dblclick div.todo-content" : "edit",
    "click span.todo-destroy"   : "clear",
    "keydown .todo-input"       : "updateOnEnter"
  },

  
  initialize: function(model) {
    this.parent();
    this.model = model;

    this.model.addEvent('change', this.render.bind(this));
    this.model.addEvent('destroy', this.remove.bind(this));

    this.model.view = this;
  },

  render: function() {
    this.element.set('html',this.template({ task: this.model.toJSON() }));
    this.setContent();
    return this;
  },


  setContent: function() {
    var content = this.model.get('content');
    this.element.getElement('.todo-content').set('html',content);
    this.inputEl = this.element.getElement('.todo-input');
    this.inputEl.addEvent('blur', this.close.bind(this));
    this.inputEl.set('value',content);
  },

  toggleDone: function() {
    this.model.toggle();
  },

  edit: function() {
    this.element.addClass("editing");
    this.inputEl.focus();
  },

  close: function() {
    this.model.save({content: this.inputEl.get('value')});
    this.element.removeClass("editing");
  },

  updateOnEnter: function(e) {
    if (e.key == 'enter') this.close();
  },

  remove: function() {
    this.element.destroy();
  },

  clear: function() {
    this.model.clear();
  }
});

App.Controller.Main = new Class({
	
  Extends: Moovoodoo.Controller,

  events: {
    "keydown #new-todo"  : "createOnEnter",
    "keyup #new-todo"    : "showTooltip",
    "click .todo-clear a": "clearCompleted"
  },

  statsTemplate: _.template(document.getElement('#stats-template').get('html')),

  initialize: function(element){
    this.element = element;
    this.parent(element);

    this.inputEl = this.element.getElement('#new-todo');

    Todos.addEvent('add',   function(event) { this.addOne(event.model); }.bind(this));
    Todos.addEvent('reset', this.addAll.bind(this));
    Todos.addEvent('all',   this.render.bind(this));

    Todos.fetch();
  },

  render: function(){
    console.log('re-render stats');
    document.getElement('#todo-stats').set('html', this.statsTemplate({
      total:      Todos.length,
      done:       Todos.done().length,
      remaining:  Todos.remaining().length
    }));
  },

  addOne: function(todo){
    var view = new App.Controller.Todo(todo);
    document.getElement("#todo-list").grab(view.render().element,'bottom');
  },

  addAll : function(){
    Todos.each(this.addOne);
  },

  newAttributes: function() {
    return {
      content: this.inputEl.get('value'),
      done:    false
    };
  },

  createOnEnter: function(event) {
    if (event.key != 'enter') return;
    Todos.create(this.newAttributes());
    this.inputEl.set('value','');
  },

  showTooltip: function(){
    var tooltip = this.element.getElement(".ui-tooltip-top");
    var val = this.inputEl.get('value');
    if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
    if (val == '' || val == this.inputEl.get('placeholder')) return;
  },

  clearCompleted: function(){
    _.each(Todos.done(), function(todo){ todo.destroy(); });
    return false;
  }


});


window.App = new App.Controller.Main(document.getElement('#todoapp'));
});