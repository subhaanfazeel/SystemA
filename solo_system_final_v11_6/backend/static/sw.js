'use strict';
const CACHE_NAME = "solo-cache-v11.7";
const ASSETS = [
  "/",
  "/static/index.html?v11.7",
  "/static/styles.css?v11.7",
  "/static/app.js?v11.7",
  "/static/sw-register.js?v11.7",
  "/static/manifest.json",
  "/static/icon-192.svg",
  "/static/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(()=>{}))
      .catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Safe fetch handler using async/await and a single clone
self.addEventListener("fetch", event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      // only cache successful basic responses
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
        try {
          const cache = await caches.open(CACHE_NAME);
          // clone once BEFORE any use of the original response body
          cache.put(event.request, networkResponse.clone()).catch(()=>{});
        } catch(e) { /* swallow cache errors */ }
      }
      return networkResponse;
    } catch (err) {
      // network failed: try cache
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});
