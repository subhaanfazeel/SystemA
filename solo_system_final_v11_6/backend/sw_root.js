/* sw.js vv9 (root) - network-first strategy, safe in worker scope */
const CACHE_NAME = "solo-system-cache-v9";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Clear old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Claim clients so the worker starts controlling pages immediately
    await self.clients.claim();
  })());
});

// respond: try network, fall back to cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      try { const copy = response.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request, copy)); } catch(e){}
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// listen for skip waiting message from page and activate immediately
self.addEventListener('message', (event) => {
  try{
    if(event.data && event.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
  }catch(e){console.warn('sw message error', e);}
});
