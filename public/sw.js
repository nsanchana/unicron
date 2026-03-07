// Minimal service worker — enables PWA installability on Android Chrome
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  // Pass all requests through to the network — no offline caching needed
  event.respondWith(fetch(event.request));
});
