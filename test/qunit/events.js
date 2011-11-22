window.addEvent('domready', function() {

  module("Moovoodoo.Events");

  test("Events: addEvent and fireEvent", function() {
    var testClass = new Class({
    	Implements: Moovoodoo.Events,
    	initialize: function(){
    		this.counter = 0;
    	}
    });
    var obj = new testClass();
    obj.addEvent('event', function() { this.counter += 1; }.bind(obj));
    obj.fireEvent('event');
    equals(obj.counter,1,'counter should be incremented.');
    obj.fireEvent('event');
    obj.fireEvent('event');
    obj.fireEvent('event');
    obj.fireEvent('event');
    equals(obj.counter, 5, 'counter should be incremented five times.');
  });

  test("Events: addEvent 'all'", function() {
    var testClass = new Class({
    	Implements: Moovoodoo.Events,
    	initialize: function(){
    		this.counter = 0;
    	}
    });
    var obj = new testClass();
    obj.addEvent('all', function() { this.counter += 1; }.bind(obj));
    obj.fireEvent('event');
    equals(obj.counter,1,'counter should be incremented.');
    obj.fireEvent('event');
    obj.fireEvent('event');
    obj.fireEvent('event');
    obj.fireEvent('event');
    equals(obj.counter, 5, 'counter should be incremented five times.');
  });

});