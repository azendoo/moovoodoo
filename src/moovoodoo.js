
(function() {

var Moovoodoo = {};

// -- Helpers

// To use Static methods
Class.Mutators.Static = function(members){ this.extend(members);};
 
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

    // method called before sendind datas
    prepareBeforeSync: function(options){
      return options;
    },
    
    create: function(model, options){
      !options && ( options = {} );
      options.url    = Moovoodoo.rootUrl + getUrl(model);
      options.method = 'POST';
      options.data   = model.serialize();
      options        = Moovoodoo.Sync.prepareBeforeSync(options);
      new Request.JSON(options).send();
    },

    read: function(model, params, options){
      !options && ( options = {} );
      options.url    = Moovoodoo.rootUrl + getUrl(model);
      options.method = 'GET';
      options.data   = params;
      options        = Moovoodoo.Sync.prepareBeforeSync(options);
      new Request.JSON(options).send();
    },

    update: function(model, options){
      !options && ( options = {} );
      options.emulation = false;
      options.method    = 'PUT';
      options.url       = Moovoodoo.rootUrl + getUrl(model);
      options.data      = model.serialize();
      options           = Moovoodoo.Sync.prepareBeforeSync(options);
      new Request.JSON(options).send(); 
    },

    destroy: function(model, options){
      !options && ( options = {} );
      options.emulation = false;
      options.method    = 'DELETE';
      options.url       = Moovoodoo.rootUrl + getUrl(model);
      options           = Moovoodoo.Sync.prepareBeforeSync(options);
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
    options.onSuccess = function(resp) {
      if (!model.set(resp, options)) return false;
      if (onSuccess) onSuccess(model, resp);
    };
    options.onError = wrapError(options.onError, model, options);
    if(this.sync)
      return this.sync.call(this, 'read', this, options);
    else
      return Moovoodoo.Sync['read'](this, {}, options);
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

  // serialize json before sending to the server
  serialize: function(){
    return this.toJSON();
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
    var base = this.urlRoot || getUrl(this.collection) || urlError();
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

  fetch: function(params, options){
    options || (options = {});
    var onSuccess = options.onSuccess;
    options.onSuccess = function(resp){
      this[options.add ? 'add' : 'reset'](this.parse(resp),options);
      if(onSuccess) onSuccess(this, resp);
    }.bind(this);
    return (this.sync || Moovoodoo.Sync).read(this, params, options);
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
    this.models = this.sortBy(this.comparator.bind(this));
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
                this.comparator ? this.sortedIndex(model, this.comparator.bind(this)) :
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

  tagName   : 'div',
  className : '',

  initialize: function(){
    this.cid = _.uniqueId('view');
    if(!this.element) this.element = new Element(this.tagName, { 'class': this.className });
    this._delegatedEvents = [],
    this.delegateEvents();
    this.refreshElements();
  },

  $: function(selector){
    return (selector == null) ? this._getViewElement() : this._getViewElement().getElement(selector);
  },

  delegateEvents : function(events) {
    if (!(events || (events = this.events))) return;
    if (_.isFunction(events)) events = events.call(this);
    this.undelegateEvents();
    
    for (var key in events) {
      var method = this[events[key]];
      if (!method) throw new Error('Event "' + events[key] + '" does not exist');
      var match = key.match(this.eventSplitter);
      var eventName = match[1], selector = match[2];
      if (selector === '') {
        var name = eventName;
        this._getViewElement().addEvent(name, method.bind(this));
      } else {
        var name = eventName + ':relay(' + selector + ')';
        this._getViewElement().addEvent(name, method.bind(this));
      }
      this._delegatedEvents.push({ name: name, method: method.bind(this) });
    }
  },

  undelegateEvents: function(){
    this._delegatedEvents.each(function(e){
      this._getViewElement().removeEvent(e.name, e.method);
    }.bind(this));
    this._delegatedEvents = [];
  },

  refreshElements : function(elements){
    if (!(elements || (elements = this.elements))) return;
    for (var key in elements) {
      var el = this._getViewElement().getElement(elements[key]);
      this[key] = el;
    }
  },

  _getViewElement: function(){
    var el     = this.element;
    if(!el) el = this.el;
    if(!el) el = this.container;
    return el;
  }
  
});

//-- Moovoodoo.Router
Moovoodoo.Router = new Class({

  Implements: Events,

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  namedParam    : /:([\w\d]+)/g,
  splatParam    : /\*([\w\d]+)/g,
  escapeRegExp  : /[-[\]{}()+?.,\\^$|#\s]/g,
  
  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize : function(options){
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
  },

  // Manually bind a single named route to a callback. For example:
  //
  //     this.route('search/:query/p:num', 'search', function(query, num) {
  //       ...
  //     });
  //
  route : function(route, name, callback) {
    Moovoodoo.history || (Moovoodoo.history = new Moovoodoo.History());
    if (!_.isRegExp(route)) route = this._routeToRegExp(route);
    Moovoodoo.history.route(route, _.bind(function(fragment) {
      var args = this._extractParameters(route, fragment);
      callback && callback.apply(this, args);
      this.fireEvent.apply(this, ['route:' + name].concat(args));
    }, this));
  },

  // Simple proxy to `Backbone.history` to save a fragment into the history.
  navigate : function(fragment, options) {
    Moovoodoo.history.navigate(fragment, options);
  },

  // Bind all defined routes to `Moovoodoo.history`. We have to reverse the
  // order of the routes here to support behavior where the most general
  // routes can be defined at the bottom of the route map.
  _bindRoutes : function() {
    if (!this.routes) return;
    var routes = [];
    for (var route in this.routes) {
      routes.unshift([route, this.routes[route]]);
    }
    for (var i = 0, l = routes.length; i < l; i++) {
      this.route(routes[i][0], routes[i][1], this[routes[i][1]]);
    }
  },

  // Convert a route string into a regular expression, suitable for matching
  // against the current location hash.
  _routeToRegExp : function(route) {
    route = route.replace(this.escapeRegExp, "\\$&")
                 .replace(this.namedParam, "([^\/]*)")
                 .replace(this.splatParam, "(.*?)");
    return new RegExp('^' + route + '$');
  },

  // Given a route, and a URL fragment that it matches, return the array of
  // extracted parameters.
  _extractParameters : function(route, fragment) {
    return route.exec(fragment).slice(1);
  }

});

//-- fix for mootools : add event 'hashchange'
Element.Events.hashchange = {
    onAdd: function () {
      var hash = location.hash;
      var hashchange = function () {
        if (hash == location.hash) return;
        else hash = location.hash;

        var value = (hash.indexOf('#') == 0 ? hash.substr(1) : hash);
        window.fireEvent('hashchange', value);
        document.fireEvent('hashchange', value);
      };

      if ("onhashchange" in window) {
          window.onhashchange = hashchange;
      }
    }
};


//-- Moovoodoo.History
Moovoodoo.History = new Class({

  // Cached regex for cleaning hashes.
  hashStrip: /^#/,

  // Has the history handling already been started?
  historyStarted: false,

  // The default interval to poll for hash changes, if necessary, is
  // twenty times a second.
  interval: 50,

  initialize: function(){
    this.handlers = [];
  },

  // Get the cross-browser normalized URL fragment, either from the URL,
  // the hash, or the override.
  getFragment : function(fragment, forcePushState) {
    if (fragment == null) {
      if (this._hasPushState || forcePushState) {
        fragment = window.location.pathname;
        var search = window.location.search;
        if (search) fragment += search;
      } else {
        fragment = window.location.hash;
      }
    }
    fragment = decodeURIComponent(fragment.replace(this.hashStrip, ''));
    if (!fragment.indexOf(this.options.root)) fragment = fragment.substr(this.options.root.length);
    return fragment;
  },

  // Start the hash change handling, returning `true` if the current URL matches
  // an existing route, and `false` otherwise.
  start : function(options) {

    // Figure out the initial configuration. Do we need an iframe?
    // Is pushState desired ... is it available?
    if (this.historyStarted) throw new Error("Moovoodoo.history has already been started");
    this.options          = _.extend({}, {root: '/'}, this.options, options);
    this._wantsPushState  = !!this.options.pushState;
    this._hasPushState    = !!(this.options.pushState && window.history && window.history.pushState);
    var fragment          = this.getFragment();
    var docMode           = document.documentMode;
    var oldIE             = Browser.ie && Browser.version <= 7;
    if (oldIE) {
      this.iframe = new Element('iframe', { src: 'javascript:0', tabindex: '-1' } ).hide().inject(document.body).contentWindow;
      this.navigate(fragment);
    }

    // Depending on whether we're using pushState or hashes, and whether
    // 'onhashchange' is supported, determine how we check the URL state.
    if (this._hasPushState) {
      window.addEvent('popstate', this.checkUrl.bind(this));
    } else if ('onhashchange' in window && !oldIE) {
      window.addEvent('hashchange', this.checkUrl.bind(this));
    } else {
      setInterval(this.checkUrl.bind(this), this.interval);
    }

    // Determine if we need to change the base url, for a pushState link
    // opened by a non-pushState browser.
    this.fragment = fragment;
    historyStarted = true;
    var loc = window.location;
    var atRoot  = loc.pathname == this.options.root;
    if (this._wantsPushState && !this._hasPushState && !atRoot) {
      this.fragment = this.getFragment(null, true);
      window.location.replace(this.options.root + '#' + this.fragment);
      // Return immediately as browser will do redirect to new url
      return true;
    } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
      this.fragment = loc.hash.replace(this.hashStrip, '');
      window.history.replaceState({}, document.title, loc.protocol + '//' + loc.host + this.options.root + this.fragment);
    }

    if (!this.options.silent) {
      return this.loadUrl();
    }
  },

  // Add a route to be tested when the fragment changes. Routes added later may
  // override previous routes.
  route : function(route, callback) {
    this.handlers.unshift({route : route, callback : callback});
  },

  // Checks the current URL to see if it has changed, and if it has,
  // calls `loadUrl`, normalizing across the hidden iframe.
  checkUrl : function(e) {
    var current = this.getFragment();
    if (current == this.fragment && this.iframe) current = this.getFragment(this.iframe.location.hash);
    if (current == this.fragment || current == decodeURIComponent(this.fragment)) return false;
    if (this.iframe) this.navigate(current);
    this.loadUrl() || this.loadUrl(window.location.hash);
  },

  // Attempt to load the current URL fragment. If a route succeeds with a
  // match, returns `true`. If no defined routes matches the fragment,
  // returns `false`.
  loadUrl : function(fragmentOverride) {
    var fragment = this.fragment = this.getFragment(fragmentOverride);
    var matched = _.any(this.handlers, function(handler) {
      if (handler.route.test(fragment)) {
        handler.callback(fragment);
        return true;
      }
    });
    return matched;
  },

  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  //
  // The options object can contain `trigger: true` if you wish to have the
  // route callback be fired (not usually desirable), or `replace: true`, if
  // you which to modify the current URL without adding an entry to the history.
  navigate : function(fragment, options) {
    if (!options || options === true) options = {trigger: options};
    var frag = (fragment || '').replace(this.hashStrip, '');
    if (this.fragment == frag || this.fragment == decodeURIComponent(frag)) return;
    if (this._hasPushState) {
      if (frag.indexOf(this.options.root) != 0) frag = this.options.root + frag;
      this.fragment = frag;
      window.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, frag);
    } else {
      this.fragment = frag;
      this._updateHash(window.location, frag, options.replace);
      if (this.iframe && (frag != this.getFragment(this.iframe.location.hash))) {
        // Opening and closing the iframe tricks IE7 and earlier to push a history entry on hash-tag change.
        // When replace is true, we don't want this.
        if(!options.replace) this.iframe.document.open().close();
        this._updateHash(this.iframe.location, frag, options.replace);
      }
    }
    if (options.trigger) this.loadUrl(fragment);
  },

  // Update the hash location, either replacing the current entry, or adding
  // a new one to the browser history.
  _updateHash: function(location, fragment, replace) {
    if (replace) {
      location.replace(location.toString().replace(/(javascript:|#).*$/, "") + "#" + fragment);
    } else {
      location.hash = fragment;
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

window.Moovoodoo = Moovoodoo;

}).call(this);