/* Service Worker fir d'Interne Verwaltung (PWA). Scope: /intern/
   Network-first fir eegen Dateien (ëmmer frësch wann online, offline-fäeg
   duerch Cache). API-Uruff (aner Origin) ginn NET ofgefaangen. */
var CACHE = "ab-intern-v32";
var CORE = [
  "/intern/",
  "/intern/index.html",
  "/intern/intern.js?v=32",
  "/intern/manifest.webmanifest",
  "/assets/intern-icon-192.png",
  "/assets/intern-icon-512.png",
  "/assets/autoservice-bettenduerf-logo.png",
  "/assets/favicon.svg",
];

// Keen skipWaiting/claim: eng nei Versioun gëtt am Hannergrond installéiert an
// iwwerhëlt eréischt beim nächsten Opmaachen (wann keng al Säit méi op ass).
// Esou gëtt et NI e Reload-Loop an der oppener Säit.
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
  );
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  // Nëmmen eegen Origin a GET: API (garage-admin-Subdomain) bleift onberéiert.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/intern/") !== 0 && url.pathname.indexOf("/assets/") !== 0) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match("/intern/index.html"); });
    })
  );
});
