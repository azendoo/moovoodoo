window.addEvent('domready', function() {

  module("Moovoodoo.Model");

  var attrs = {
    id     : '1-the-tempest',
    title  : "The Tempest",
    author : "Bill Shakespeare",
    length : 123
  };

  var proxy = new Class({ Extends: Moovoodoo.Model });
  var doc = new proxy(attrs);

  var klass = new Class({
    Extends: Moovoodoo.Collection,
    url : function() { return '/collection'; }
  });

  var collection = new klass();
  collection.add(doc);

  test("Model: initialize", function() {
    var Model = new Class({
      Extends: Moovoodoo.Model,

      initialize: function(attributes, options) {
        this.parent(attributes, options);
        this.one = 1;
        equals(this.collection, collection);
      }
    });
    var model = new Model({}, {collection: collection});
    equals(model.one, 1);
    equals(model.collection, collection);
  });

  test("Model: initialize with attributes and options", function() {
    var Model = new Class({
      Extends: Moovoodoo.Model,
      initialize: function(attributes, options) {
        this.parent(attributes, options);
        this.one = options.one;
      }
    });
    var model = new Model({}, {one: 1});
    equals(model.one, 1);
  });

  test("Model: url", function() {
    equals(doc.url(), '/collection/1-the-tempest');
    doc.collection.url = '/collection/';
    equals(doc.url(), '/collection/1-the-tempest');
    doc.collection = null;
    var failed = false;
    try {
      doc.url();
    } catch (e) {
      failed = true;
    }
    equals(failed, true);
    doc.collection = collection;
  });

  test("Model: url when using urlRoot, and uri encoding", function() {
    var Model = new Class({
      Extends: Moovoodoo.Model,
      urlRoot: '/collection'
    });
    var model = new Model();
    equals(model.url(), '/collection');
    model.set({id: '+1+'});
    equals(model.url(), '/collection/%2B1%2B');
  });

  test("Model: clone", function() {
    attrs = { 'foo': 1, 'bar': 2, 'baz': 3};
    a = new Moovoodoo.Model(attrs);
    b = a.clone();
    equals(a.get('foo'), 1);
    equals(a.get('bar'), 2);
    equals(a.get('baz'), 3);
    equals(b.get('foo'), a.get('foo'), "Foo should be the same on the clone.");
    equals(b.get('bar'), a.get('bar'), "Bar should be the same on the clone.");
    equals(b.get('baz'), a.get('baz'), "Baz should be the same on the clone.");
    a.set({foo : 100});
    equals(a.get('foo'), 100);
    equals(b.get('foo'), 1, "Changing a parent attribute does not change the clone.");
  });

  test("Model: isNew", function() {
    attrs = { 'foo': 1, 'bar': 2, 'baz': 3};
    a = new Moovoodoo.Model(attrs);
    ok(a.isNew(), "it should be new");
    attrs = { 'foo': 1, 'bar': 2, 'baz': 3, 'id': -5 };
    a = new Moovoodoo.Model(attrs);
    ok(!a.isNew(), "any defined ID is legal, negative or positive");
    attrs = { 'foo': 1, 'bar': 2, 'baz': 3, 'id': 0 };
    a = new Moovoodoo.Model(attrs);
    ok(!a.isNew(), "any defined ID is legal, including zero");
    ok( new Moovoodoo.Model({          }).isNew(), "is true when there is no id");
    ok(!new Moovoodoo.Model({ 'id': 2  }).isNew(), "is false for a positive integer");
    ok(!new Moovoodoo.Model({ 'id': -5 }).isNew(), "is false for a negative integer");
  });

  test("Model: get", function() {
    equals(doc.get('title'), 'The Tempest');
    equals(doc.get('author'), 'Bill Shakespeare');
  });

  test("Model: escape", function() {
    equals(doc.escape('title'), 'The Tempest');
    doc.set({audience: 'Bill & Bob'});
    equals(doc.escape('audience'), 'Bill &amp; Bob');
    doc.set({audience: 'Tim > Joan'});
    equals(doc.escape('audience'), 'Tim &gt; Joan');
    doc.set({audience: 10101});
    equals(doc.escape('audience'), '10101');
    doc.unset('audience');
    equals(doc.escape('audience'), '');
  });

  test("Model: has", function() {
    attrs = {};
    a = new Moovoodoo.Model(attrs);
    equals(a.has("name"), false);
    _([true, "Truth!", 1, false, '', 0]).each(function(value) {
      a.set({'name': value});
      equals(a.has("name"), true);
    });
    a.unset('name');
    equals(a.has('name'), false);
    _([null, undefined]).each(function(value) {
      a.set({'name': value});
      equals(a.has("name"), false);
    });
  });

  test("Model: set and unset", function() {
    attrs = {id: 'id', foo: 1, bar: 2, baz: 3};
    a = new Moovoodoo.Model(attrs);
    var changeCount = 0;
    a.addEvent("change:foo", function() { changeCount += 1; });
    a.set({'foo': 2});
    ok(a.get('foo')== 2, "Foo should have changed.");
    ok(changeCount == 1, "Change count should have incremented.");
    a.set({'foo': 2}); // set with value that is not new shouldn't fire change event
    ok(a.get('foo')== 2, "Foo should NOT have changed, still 2");
    ok(changeCount == 1, "Change count should NOT have incremented.");

    a.unset('foo');
    ok(a.get('foo')== null, "Foo should have changed");
    ok(changeCount == 2, "Change count should have incremented for unset.");

    a.unset('id');
    equals(a.id, undefined, "Unsetting the id should remove the id property.");
  });

  test("Model: multiple unsets", function() {
    var i = 0;
    var counter = function(){ i++; };
    var model = new Moovoodoo.Model({a: 1});
    model.addEvent("change:a", counter);
    model.set({a: 2});
    model.unset('a');
    model.unset('a');
    equals(i, 2, 'Unset does not fire an event for missing attributes.');
  });

  test("Model: unset and changedAttributes", function() {
    var model = new Moovoodoo.Model({a: 1});
    model.unset('a', {silent: true});
    var changedAttributes = model.changedAttributes();
    ok('a' in changedAttributes, 'changedAttributes should contain unset properties');

    changedAttributes = model.changedAttributes();
    ok('a' in changedAttributes, 'changedAttributes should contain unset properties when running changedAttributes again after an unset.');
  });

  test("Model: using a non-default id attribute.", function() {
    Moovoodoo.Model.idAttribute = '_id';
    var model = new Moovoodoo.Model({id: 'eye-dee', _id: 25, title: 'Model'});
    equals(model.get('id'), 'eye-dee');
    equals(model.id, 25);
    equals(model.isNew(), false);
    model.unset('_id');
    equals(model.id, undefined);
    equals(model.isNew(), true);
    Moovoodoo.Model.idAttribute = 'id';
  });

  test("Model: set an empty string", function() {
    var model = new Moovoodoo.Model({name : "Model"});
    model.set({name : ''});
    equals(model.get('name'), '');
  });

  test("Model: clear", function() {
    var changed;
    var model = new Moovoodoo.Model({name : "Model"});
    model.addEvent("change:name", function(){ changed = true; });
    model.clear();
    equals(changed, true);
    equals(model.get('name'), undefined);
  });

  test("Model: defaults", function() {
    var Defaulted = new Class({
      Extends: Moovoodoo.Model,
      defaults: {
        "one": 1,
        "two": 2
      }
    });
    var model = new Defaulted({two: null});
    equals(model.get('one'), 1);
    equals(model.get('two'), null);
    Defaulted = new Class({
      Extends: Moovoodoo.Model,
      defaults: function() {
        return {
          "one": 3,
          "two": 4
        };
      }
    });
    var model = new Defaulted({two: null});
    equals(model.get('one'), 3);
    equals(model.get('two'), null);
  });

  test("Model: change, hasChanged, changedAttributes, previous, previousAttributes", function() {
    var model = new Moovoodoo.Model({name : "Tim", age : 10});
    model.urlRoot = 
    equals(model.changedAttributes(), false);
    model.addEvent('change', function() {
      ok(model.hasChanged('name'), 'name changed');
      ok(!model.hasChanged('age'), 'age did not');
      ok(_.isEqual(model.changedAttributes(), {name : 'Rob'}), 'changedAttributes returns the changed attrs');
      equals(model.previous('name'), 'Tim');
      ok(_.isEqual(model.previousAttributes(), {name : "Tim", age : 10}), 'previousAttributes is correct');
    });
    model.set({name : 'Rob'}, {silent : true});
    equals(model.hasChanged(), true);
    equals(model.hasChanged('name'), true);
    model.change();
    equals(model.get('name'), 'Rob');
  });

  test("Model: change with options", function() {
    var value;
    var model = new Moovoodoo.Model({name: 'Rob'});
    model.addEvent('change', function(event) {
      value = event.options.prefix + event.model.get('name');
    });
    model.set({name: 'Bob'}, {silent: true});
    model.change({prefix: 'Mr. '});
    equals(value, 'Mr. Bob');
    model.set({name: 'Sue'}, {prefix: 'Ms. '});
    equals(value, 'Ms. Sue');
  });

  test("Model: change after initialize", function () {
    var changed = 0;
    var attrs = {id: 1, label: 'c'};
    var obj = new Moovoodoo.Model(attrs);
    obj.addEvent('change', function() { changed += 1; });
    obj.set(attrs);
    equals(changed, 0);
  });

  test("Model: save within change event", function () {
    var model = new Moovoodoo.Model({firstName : "Taylor", lastName: "Swift"});
    model.urlRoot = '/collection';
    model.addEvent('change', function () {
      model.save();
      ok(_.isEqual(lastRequest.model, model));
    });
    model.set({lastName: 'Hicks'});
  });

  test("Model: validate after save", function() {
    var lastError, model = new Moovoodoo.Model();
    model.urlRoot = '/collection';
    model.validate = function(attrs) {
      if (attrs.admin) return "Can't change admin status.";
    };
    model.sync = function(method, model, options) {
      options.onSuccess.call(this, {admin: true});
    };
    model.save(null, {onError: function(model, error) {
      console.log('erroring!');
      lastError = error;
    }});

    equals(lastError, "Can't change admin status.");
  });

  test("Model: save", function() {
    doc.save({title : "Henry V"});
    equals(lastRequest.type, 'update');
    ok(_.isEqual(lastRequest.model, doc));
  });

  test("Model: fetch", function() {
    doc.fetch();
    ok(lastRequest.type, 'read');
    ok(_.isEqual(lastRequest.model, doc));
  });

  test("Model: destroy", function() {
    doc.destroy();
    equals(lastRequest.type, 'destroy');
    ok(_.isEqual(lastRequest.model, doc));
  });

  test("Model: non-persisted destroy", function() {
    attrs = { 'foo': 1, 'bar': 2, 'baz': 3};
    a = new Moovoodoo.Model(attrs);
    a.sync = function() { throw "should not be called"; };
    ok(a.destroy(), "non-persisted model should not call sync");
  });

  test("Model: validate", function() {
    var lastError;
    var model = new Moovoodoo.Model();
    model.validate = function(attrs) {
      if (attrs.admin) return "Can't change admin status.";
    };
    model.addEvent('error', function(event) {
      lastError = event.error;
    });
    var result = model.set({a: 100});
    equals(result, model);
    equals(model.get('a'), 100);
    equals(lastError, undefined);
    result = model.set({admin: true}, {silent: true});
    equals(lastError, undefined);
    equals(model.get('admin'), true);
    result = model.set({a: 200, admin: true});
    equals(result, false);
    equals(model.get('a'), 100);
    equals(lastError, "Can't change admin status.");
  });

  test("Model: validate on unset and clear", function() {
    var error;
    var model = new Moovoodoo.Model({name: "One"});
    model.validate = function(attrs) {
      if ("name" in attrs) {
        if (!attrs.name) {
          error = true;
          return "No thanks.";
        }
      }
    };
    model.set({name: "Two"});
    equals(model.get('name'), 'Two');
    equals(error, undefined);
    model.unset('name');
    equals(error, true);
    equals(model.get('name'), 'Two');
    model.clear();
    equals(model.get('name'), 'Two');
    delete model.validate;
    model.clear();
    equals(model.get('name'), undefined);
  });

  test("Model: validate with error callback", function() {
    var lastError, boundError;
    var model = new Moovoodoo.Model();
    model.validate = function(attrs) {
      if (attrs.admin) return "Can't change admin status.";
    };
    var callback = function(model, error) {
      lastError = error;
    };
    model.addEvent('error', function(event) {
      boundError = true;
    });
    var result = model.set({a: 100}, {onError: callback});
    equals(result, model);
    equals(model.get('a'), 100);
    equals(lastError, undefined);
    equals(boundError, undefined);
    result = model.set({a: 200, admin: true}, {onError: callback});
    equals(result, false);
    equals(model.get('a'), 100);
    equals(lastError, "Can't change admin status.");
    equals(boundError, undefined);
  });

  test("Model: defaults always extend attrs (#459)", function() {
    var Defaulted = new Class({
      Extends: Moovoodoo.Model,
      defaults: {one: 1},
      initialize : function(attrs, opts) {
        this.parent(attrs,opts);
        equals(this.get("one"), 1);
      }
    });
    var providedattrs = new Defaulted({});
    var emptyattrs = new Defaulted();
  });

  /*test("Model: Nested change events don't clobber previous attributes", function() {
    var A = new Class({
      Extends: Moovoodoo.Model,
      initialize: function(attrs, opts) {
        this.parent(attrs,opts);
        this.addEvent("change:state", function(event) {
          equals(event.model.previous('state'), undefined);
          equals(event.newState, 'hello');
          // Fire a nested change event.
          this.set({ other: "whatever" });
        });
      }
    });

    var B = new Class({
      Extends: Moovoodoo.Model,
      initialize: function(attrs, opts) {
        this.parent(attrs,opts);
        this.get("a").addEvent("change:state", function(event) {
          equals(event.model.previous('state'), undefined);
          equals(event.newState, 'hello');
        });
      }
    });

    a = new A();
    b = new B({a: a});
    a.set({state: 'hello'});
  });

  test("Model: Multiple nested calls to set", function() {
    var model = new Moovoodoo.Model({});
    model.addEvent('change', function() {
      model.set({b: 1});
      model.set({a: 1});
    });
    model.set({a: 1});
  });*/

});