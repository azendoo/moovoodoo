//-- Movoodoo.RailsAuthToken
var MoovoodooRailsAuthTokenAdapter = {

  //
  // Given an instance of Moovoodoo, route its sync() function so that
  // it executes through this one first, which mixes in the CSRF 
  // authenticity token that Rails 3 needs to protect requests from
  // forgery. Optionally, the token's name and value can be supplied
  // by the caller.
  //
  fixSync: function(Moovoodoo){

    // if auth token null, return here
    if( !rails.csrf.token ) return false;

    var _prepareBeforeSync = Moovoodoo.Sync.prepareBeforeSync
    Moovoodoo.Sync.prepareBeforeSync = function(options){
      options.headers = { 'X-CSRF-Token': rails.csrf.token };
      return options;
    }
  }
};

window.addEvent('domready', function(){
  MoovoodooRailsAuthTokenAdapter.fixSync(Moovoodoo);
});
