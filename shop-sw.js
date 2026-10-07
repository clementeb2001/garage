"use strict";

var CACHE = "autoservice-shop-v8";
var IMAGE_CACHE = "autoservice-product-images-v1";
var MAX_IMAGES = 160;
var CORE = [
  "/shop.html",
  "/styles.css?v=84",
  "/script.js?v=27",
  "/shop.js?v=70",
  "/shop-data.js?v=11",
  "/vehicle-catalog.js?v=4",
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(CORE); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE && key !== IMAGE_CACHE; }).map(function (key) { return caches.delete(key); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  var isProductImage = event.request.destination === "image" &&
    (url.hostname === "cdn.sanity.io" || url.hostname === "3cerp.eu" || url.hostname === "dba.com.au");
  var isCatalogAsset = url.origin === location.origin &&
    /\/(?:shop(?:-data-dba)?|remus-parts|script|styles)\.(?:js|css)$/.test(url.pathname);
  if (!isProductImage && !isCatalogAsset) return;

  var cacheName = isProductImage ? IMAGE_CACHE : CACHE;
  event.respondWith(caches.open(cacheName).then(function (cache) {
    return cache.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && (response.ok || response.type === "opaque")) {
          cache.put(event.request, response.clone()).then(function () {
            if (!isProductImage) return;
            cache.keys().then(function (keys) {
              if (keys.length > MAX_IMAGES) cache.delete(keys[0]);
            });
          });
        }
        return response;
      });
      return cached || network;
    });
  }));
});
