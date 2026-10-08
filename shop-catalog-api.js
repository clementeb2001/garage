(function(){
  "use strict";
  var API="https://garage-admin.autoservicebettenduerf.lu/catalog",loaded={};
  function getJson(url){return fetch(url,{mode:"cors",credentials:"omit"}).then(function(response){if(!response.ok)throw new Error("catalog_http_"+response.status);return response.json();});}
  function loadMeta(){return getJson(API+"/meta").then(function(data){var m=data.catalog||{};window.SHOP_META=m.meta||{};window.SHOP_MAKES=m.makes||[];window.SHOP_BRANDS=m.brands||{};window.SHOP_ENGINES=m.engines||[];window.SHOP_VARIANTS=m.variants||[];window.SHOP_GENS=m.generations||[];window.SHOP_IMAGES=m.images||[];window.SHOP_PRODUCTS=[];});}
  function loadPage(manufacturer,cursor){var url=API+"/products?manufacturer="+encodeURIComponent(manufacturer)+"&limit=1000";if(cursor)url+="&cursor="+encodeURIComponent(cursor);return getJson(url).then(function(data){Array.prototype.push.apply(window.SHOP_PRODUCTS,data.items||[]);return data.nextCursor?loadPage(manufacturer,data.nextCursor):null;});}
  function loadManufacturer(manufacturer){if(loaded[manufacturer])return loaded[manufacturer];loaded[manufacturer]=loadPage(manufacturer,"").then(function(){if(manufacturer==="DBA")window.SHOP_DBA_LOADED=true;});return loaded[manufacturer];}
  window.GARAGE_CATALOG={
    init:function(){
      return loadMeta().then(function(){
        return Promise.all([loadManufacturer("REMUS"),loadManufacturer("DBA")]);
      });
    },
    loadManufacturer:loadManufacturer
  };
})();
