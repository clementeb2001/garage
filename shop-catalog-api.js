(function(){
  "use strict";
  var API="https://garage-admin.autoservicebettenduerf.lu/catalog",loaded={};
  // Meta gëtt séier erwaart a gate de Shop → kuerzen Timeout.
  // D'Produitseiten sinn grouss (DBA-Katalog = e puer MB iwwer e puer Säiten)
  // a lueden am Hannergrond → vill méi generéisen Timeout, soss gëtt e lues
  // awer lafenden Download ofgebrach an et weist nëmmen d'REMUS-Deeler.
  var META_TIMEOUT=15000,PRODUCT_TIMEOUT=45000,RETRIES=2;
  function ensureProducts(){if(!Array.isArray(window.SHOP_PRODUCTS))window.SHOP_PRODUCTS=[];}
  // Eenzel Ufro mat Timeout (hänkt se, gëtt se ofgebrach amplaz éiweg ze waarden).
  function fetchOnce(url,timeoutMs){
    var ctrl=typeof AbortController!=="undefined"?new AbortController():null;
    var timer=ctrl?setTimeout(function(){ctrl.abort();},timeoutMs):0;
    var opts={mode:"cors",credentials:"omit"};
    if(ctrl)opts.signal=ctrl.signal;
    function done(){if(timer)clearTimeout(timer);}
    return fetch(url,opts).then(function(response){
      if(!response.ok)throw new Error("catalog_http_"+response.status);
      return response.json();
    }).then(function(data){done();return data;},function(err){done();throw err;});
  }
  // Mat Backoff nei probéieren (transient Netz-/Server-Feeler ofgefaangen).
  function getJson(url,timeoutMs,attempt){
    attempt=attempt||0;
    return fetchOnce(url,timeoutMs).catch(function(err){
      if(attempt>=RETRIES)throw err;
      return new Promise(function(res){setTimeout(res,500*(attempt+1));}).then(function(){return getJson(url,timeoutMs,attempt+1);});
    });
  }
  function loadMeta(){return getJson(API+"/meta",META_TIMEOUT).then(function(data){var m=data.catalog||{};window.SHOP_META=m.meta||{};window.SHOP_MAKES=m.makes||[];window.SHOP_BRANDS=m.brands||{};window.SHOP_ENGINES=m.engines||[];window.SHOP_VARIANTS=m.variants||[];window.SHOP_GENS=m.generations||[];window.SHOP_IMAGES=m.images||[];ensureProducts();});}
  // All Säite lokal sammelen; eréischt bei komplettem Erfolleg an SHOP_PRODUCTS
  // iwwerhuelen – sou gëtt et keng hallef gelueden / duebel Donnéeën.
  function fetchAll(manufacturer){
    var acc=[];
    function page(cursor){
      var url=API+"/products?manufacturer="+encodeURIComponent(manufacturer)+"&limit=1000";
      if(cursor)url+="&cursor="+encodeURIComponent(cursor);
      return getJson(url,PRODUCT_TIMEOUT).then(function(data){
        if(data&&data.items)Array.prototype.push.apply(acc,data.items);
        return data&&data.nextCursor?page(data.nextCursor):acc;
      });
    }
    return page("");
  }
  function loadManufacturer(manufacturer){
    if(loaded[manufacturer])return loaded[manufacturer];
    var promise=fetchAll(manufacturer).then(function(items){
      ensureProducts();
      Array.prototype.push.apply(window.SHOP_PRODUCTS,items);
      if(manufacturer==="DBA")window.SHOP_DBA_LOADED=true;
    });
    loaded[manufacturer]=promise;
    // Bei Feeler de Cache läschen, sou datt eng nei Ufro nach eng Kéier ka probéieren.
    promise.catch(function(){if(loaded[manufacturer]===promise)delete loaded[manufacturer];});
    return promise;
  }
  window.GARAGE_CATALOG={init:function(){return loadMeta().then(function(){return loadManufacturer("REMUS");});},loadManufacturer:loadManufacturer};
})();
