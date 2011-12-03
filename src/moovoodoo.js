 var Moovoodoo = {};

// -- Helpers

// To use Static methods
Class.Mutators.Static        = function(members){ this.extend(members);};
 
var getUrl = function(object) {
  if (!(object && object.url)) return null;
  return _.isFunction(object.url) ? object.url() : object.url;
};

// Throw an error when a URL is needed, and none is supplied.
var urlError = function() {
  throw new Error('A "url" property or function must be specified');
};

// -- Url root to sync,change if needed
Moovoodoo.rootUrl = '/';

// -- Moovoodoo.Event
Moovoodoo.Events = new Class({
  
  Implements: Events,

  fireEvent: function(type, args, delay){
    var events = this.$events[type];
    var allEvents = this.$events['all'];
    if(allEvents)
      events = (!events) ? this.$events['all'] : events.concat(this.$events['all']);
    if (!events) return this;
    args = (args) ? Array.from(args) : [{}];
    args[0]['type'] = type;
            
    events.each(function(fn){
      if (delay) fn.delay(delay, this, args);
      else fn.apply(this, args);
    }, this);
    return this;
  }

});

// -- Moovoodoo.Sync
Moovoodoo.Sync = new Class({
  Static: {
    
    create: function(model, options){
      !options && ( options = {} );
      options.url = Moovoodoo.rootUrl + getUrl(model);
      options.method = 'POST';
      options.data   = model.toJSON();
      new Request.JSON(options).send();
    },

    read: function(model, params, options){
      !options && ( options = {} );
      options.url = Moovoodoo.rootUrl + getUrl(model);
      options.method = 'GET';
      options.data   = params;
      new Request.JSON(options).send();
    },

    update: function(model, options){
      !options && ( options = {} );
      options.emulation = false;
      options.method    = 'PUT';
      options.url       = Moovoodoo.rootUrl + getUrl(model);
      options.data      = model.toJSON();
      new Request.JSON(options).send(); 
    },

    destroy: function(model, options){
      !options && ( options = {} );
      options.emulation = false;
      options.method    = 'DELETE';
      options.url       = Moovoodoo.rootUrl + getUrl(model);
      new Request.JSON(options).send();
    }
  }
});

// -- Moovoodoo.Model
Moovoodoo.Model = new Class({

  Implements: Moovoodoo.Events,

  Static : {
    idAttribute : 'id'
  },

  initialize: function(attributes, options){
    var defaults;
    attributes || (attributes = {});
    if (defaults = this.defaults) {
      if (_.isFunction(defaults)) defaults = defaults.call(this);
      attributes = _.extend({}, defaults, attributes);
    }
    this.attributes = {};
    this._escapedAttributes = {};
    this.cid = _.uniqueId('c');
    this.set(attributes, {silent : true});
    this._changed = false;
    this._previousAttributes = _.clone(this.attributes);
    if (options && options.collection) this.collection = options.collection;
    if (this.setup) this.setup(attributes);
  },

  escape : function(attr) {
    var html;
    if (html = this._escapedAttributes[attr]) return html;
    var val = this.attributes[attr];
    return this._escapedAttributes[attr] = _.escape(val == null ? '' : '' + val);
  },

  set: function(attrs, options){
    // Extract attributes and options.
    options || (options = {});
    if (!attrs) return this;
    if (attrs.attributes) attrs = attrs.attributes;
    var now = this.attributes, escaped = this._escapedAttributes;

    // Run validation.
    if (!options.silent && this.validate && !this._performValidation(attrs, options)) return false;

    // Check for changes of `id`.
    if (Moovoodoo.Model.idAttribute in attrs) this.id = attrs[Moovoodoo.Model.idAttribute];

    // We're about to start triggering change events.
    var alreadyChanging = this._changing;
    this._changing = true;

    // Update attributes.
    for (var attr in attrs) {
      var val = attrs[attr];
      if (!_.isEqual(now[attr], val)) {
        now[attr] = val;
        delete escaped[attr];
        this._changed = true;
        if (!options.silent) this.fireEvent('change:' + attr, { model : this, value:  val } );
      }
    }

    // Fire the `"change"` event, if the model has been changed.
    if (!alreadyChanging && !options.silent && this._changed) this.change(options);
    this._changing = false;
    return this;
  },

  unset : function(attr, options) {
    if (!(attr in this.attributes)) return this;
    options || (options = {});
    var value = this.attributes[attr];

    // Run validation.
    var validObj = {};
    validObj[attr] = void 0;
    if (!options.silent && this.validate && !this._performValidation(validObj, options)) return false;

    // changedAttributes needs to know if an attribute has been unset.
    (this._unsetAttributes || (this._unsetAttributes = [])).push(attr);

    // Remove the attribute.
    delete this.attributes[attr];
    delete this._escapedAttributes[attr];
    if (attr == Moovoodoo.Model.idAttribute) delete this.id;
    this._changed = true;
    if (!options.silent) {
      this.fireEvent('change:' + attr, this, void 0, options);
      this.change(options);
    }
    return this;
  },

  get: function(attr){
    return this.attributes[attr];
  },

  has: function(attr){
    return this.attributes[attr] != null;
  },

  change: function(options){
    this.fireEvent('change', { model: this, options: options } );
    this._previousAttributes = _.clone(this.attributes);
    this._unsetAttributes = null;
    this._changed = false;
  },

  hasChanged : function(attr) {
    if (attr) return this._previousAttributes[attr] != this.attributes[attr];
    return this._changed;
  },

  clear : function(options) {
    options || (options = {});
    var attr;
    var old = this.attributes;

    // Run validation.
    var validObj = {};
    for (attr in old) validObj[attr] = void 0;
    if (!options.silent && this.validate && !this._performValidation(validObj, options)) return false;

    this.attributes = {};
    this._escapedAttributes = {};
    this._changed = true;
    if (!options.silent) {
      for (attr in old) {
        this.fireEvent('change:' + attr, this, void 0, options );
      }
      this.change(options);
    }
    return this;
  },

  fetch : function(options) {
    options || (options = {});
    var model = this;
    var onSuccess = options.onSuccess;
    options.onSuccess = function(resp, status, xhr) {
      if (!model.set(model.parse(resp), options)) return false;
      if (onSuccess) onSuccess(model, resp);
    };
    options.onError = wrapError(options.onError, model, options);
    if(this.sync)
      return this.sync.call(this, 'read', this, options);
    else
      return Moovoodoo.Sync['read'](this, options);
  },

  changedAttributes : function(now) {
    now || (now = this.attributes);
    var old = this._previousAttributes, unset = this._unsetAttributes;

    var changed = false;
    for (var attr in now) {
      if (!_.isEqual(old[attr], now[attr])) {
        changed || (changed = {});
        changed[attr] = now[attr];
      }
    }

    if (unset) {
      changed || (changed = {});
      var len = unset.length;
      while (len--) changed[unset[len]] = void 0;
    }

    return changed;
  },

  previous : function(attr) {
    if (!attr || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  },

  previousAttributes : function() {
    return _.clone(this._previousAttributes);
  },

  isNew : function() {
    return this.id == null;
  },

  clone: function(){
    return Object.clone(this);
  },

  toJSON : function() {
    return _.clone(this.attributes);
  },

  save: function(attrs, options) {
    options || (options = {});
    if (attrs && !this.set(attrs, options)) return false;
    var model = this;
    var success = options.onSuccess;
    options.onSuccess = function(resp) {
      if (!model.set(model.parse(resp), options)) return false;
      if (success) success(model, resp);
    };
    options.onError = wrapError(options.onError, model, options);
    var method = this.isNew() ? 'create' : 'update';
    if(this.sync)
      return this.sync.call(this, method, this, options);
    else
      return Moovoodoo.Sync[method](this, options);
  },

  // **parse** converts a response into a list of models to be added to the
  // collection. The default implementation is just to pass it through.
  parse : function(responseJSON) {
    return responseJSON;
  },

  destroy : function(options) {
    options || (options = {});
    if (this.isNew()) return this.fireEvent('destroy', { model: this, collection: this.collection, options: options });
    var model = this;
    var success = options.onSuccess;
    options.onSuccess = function(resp) {
      model.fireEvent('destroy', { model: model, collection: model.collection, options: options } );
      if (success) success(model, resp);
    };
    options.onError = wrapError(options.onError, model, options);
    if(this.sync)
      return this.sync.call(this, 'destroy', this, options);
    else
      return Moovoodoo.Sync['destroy'](this, options);
  },

  setUrl: function(url){
    this.url = url;
  },

  url : function() {
    var base = getUrl(this.collection) || this.urlRoot || urlError();
    if (this.isNew()) return base;
    return base + (base.charAt(base.length - 1) == '/' ? '' : '/') + encodeURIComponent(this.id);
  },

  _performValidation : function(attrs, options) {
    var error = this.validate(attrs);
    if (error) {
      if (options.onError) {
        options.onError(this, error, options);
      } else {
        this.fireEvent('error', { model : this, error: error, options: options } );
      }
      return false;
    }
    return true;
  }

});



// -- Moovoodoo.Collection
Moovoodoo.Collection = new Class({

  Implements: Moovoodoo.Events,

  model: Moovoodoo.Model,

  initialize: function(models, options){
    options || (options = {});
    if (options.comparator) this.comparator = options.comparator;
    this._reset();
    if (models) this.reset(models, {silent: true});
  },

  get : function(id) {
    if (id == null) return null;
    return this._byId[id.id != null ? id.id : id];
  },

  getByCid : function(cid) {
    return cid && this._byCid[cid.cid || cid];
  },

  create: function(model,options){
    options || (options = {});
    model = this._prepareModel(model, options);
    if (!model) return false;
    var onSuccess = options.onSuccess;
    options.onSuccess = function(resp) {
      this.add(resp, options);
      if (onSuccess) onSuccess(this, resp);
    }.bind(this);
    model.save(null, options);
    return model;
  },

  fetch: function(options){
    options || (options = {});
    var onSuccess = options.onSuccess;
    options.onSuccess = function(resp){
      this[options.add ? 'add' : 'reset'](this.parse(resp),options);
      if(onSuccess) onSuccess(this, resp);
    }.bind(this);
    return (this.sync || Moovoodoo.Sync).read(this,{},options);
  },

  reset : function(models, options) {
    models  || (models = []);
    options || (options = {});
    this.each(this._removeReference.bind(this));
    this._reset();
    this.add(models, {silent: true});
    if (!options.silent) this.fireEvent('reset', { collection: this, options: options } );
    return this;
  },

  // **parse** converts a response into a list of models to be added to the
  // collection. The default implementation is just to pass it through.
  parse : function(resp) {
    return resp;
  },

  add: function(models,options){
    if (_.isArray(models)) {
      for (var i = 0, l = models.length; i < l; i++) {
        this._add(models[i], options);
      }
    } else {
      this._add(models, options);
    }
    return this;
  },

  remove : function(models, options) {
    if (_.isArray(models)) {
      for (var i = 0, l = models.length; i < l; i++) {
        this._remove(models[i], options);
      }
    } else {
      this._remove(models, options);
    }
    return this;
  },

  at : function(index) {
    return this.models[index];
  },

  pluck : function(attr) {
    return _.map(this.models, function(model){ return model.get(attr); });
  },

  sort : function(options) {
    options || (options = {});
    if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
    this.models = this.sortBy(this.comparator);
    if (!options.silent) this.fireEvent('reset', { collection: this, options: options} );
    return this;
  },

  _add: function(model,options){
    options || (options = {});
    model = this._prepareModel(model, options);
    if (!model) return false;
    var already = this.getByCid(model);
    if (already) throw new Error(["Can't add the same model to a set twice", already.id]);
    this._byId[model.id] = model;
    this._byCid[model.cid] = model;
    var index = options.at != null ? options.at :
                this.comparator ? this.sortedIndex(model, this.comparator) :
                this.length;
    this.models.splice(index, 0, model);
    model.addEvent('all', this._onModelEvent.bind(this));
    this.length++;
    options.index = index;
    if (!options.silent) model.fireEvent('add', { model: model, collection: this, options: options } );
    return model;
  },

  _remove : function(model, options) {
    options || (options = {});
    model = this.getByCid(model) || this.get(model);
    if (!model) return null;
    delete this._byId[model.id];
    delete this._byCid[model.cid];
    var index = this.indexOf(model);
    this.models.splice(index, 1);
    this.length--;
    options.index = index;
    if (!options.silent) model.fireEvent('remove', {model: model, collection: this, options: options});
    this._removeReference(model);
    return model;
  },

  _removeReference : function(model) {
    if (this == model.collection) {
      delete model.collection;
    }
    model.removeEvent('all', this._onModelEvent.bind(this));
  },

  _reset : function(options) {
    this.length = 0;
    this.models = [];
    this._byId  = {};
    this._byCid = {};
  },

  _prepareModel : function(model, options) {
    if (!(model instanceof Moovoodoo.Model)) {
      var attrs = model;
      model = new this.model(attrs, {collection: this});
    } else if (!model.collection) {
      model.collection = this;
    }
    return model;
  },

   _onModelEvent : function(event) {
    if ((event.type == 'add' || event.type == 'remove') && event.collection != this) return;
    if (event.type == 'destroy') {
      this._remove(event.model, event.options);
    }
    if (event.model && event.type === 'change:' + Moovoodoo.Model.idAttribute) {
      delete this._byId[event.model.previous(Moovoodoo.Model.idAttribute)];
      this._byId[event.model.id] = event.model;
    }
    this.fireEvent(event.type,event);
  }

 
});

// Underscore methods that we want to implement on the Collection.
var methods = ['forEach', 'each', 'map', 'reduce', 'reduceRight', 'find', 'detect',
  'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include',
  'contains', 'invoke', 'max', 'min', 'sortBy', 'sortedIndex', 'toArray', 'size',
  'first', 'rest', 'last', 'without', 'indexOf', 'lastIndexOf', 'isEmpty', 'groupBy'];

// Mix in each Underscore method as a proxy to `Collection#models`.
_.each(methods, function(method) {
  Moovoodoo.Collection.prototype[method] = function() {
    return _[method].apply(_, [this.models].concat(_.toArray(arguments)));
  };
});

// -- Moovoodoo.Controller
Moovoodoo.Controller = new Class({

  eventSplitter : /^(\S+)\s*(.*)$/,

  tagName : 'div',

  initialize: function(){
    this.cid = _.uniqueId('view');
    if(!this.element) this.element = new Element(this.tagName);
    this.delegateEvents();
  },

  delegateEvents : function(events) {
    if (!(events || (events = this.events))) return;
    if (_.isFunction(events)) events = events.call(this);
    for (var key in events) {
      var method = this[events[key]];
      if (!method) throw new Error('Event "' + events[key] + '" does not exist');
      var match = key.match(this.eventSplitter);
      var eventName = match[1], selector = match[2];
      if (selector === '') {
        this.element.addEvent(eventName, method.bind(this));
      } else {
        this.element.addEvent(eventName + ':relay(' + selector + ')', method.bind(this));
      }
    }
  }
	
});

// Wrap an optional error callback with a fallback error event.
var wrapError = function(onError, originalModel, options) {
  return function(model, resp) {
    var resp = model === originalModel ? resp : model;
    if (onError) {
      onError(model, resp, options);
    } else {
      originalModel.fireEvent('error', { model: model, response: resp, options: options } );
    }
  };
};

var urlError = function() {
  throw new Error('A "url" property or function must be specified');
};

