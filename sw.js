// Minimal service worker — just enough for "installable" status.
// Not doing offline caching, since this app needs a live connection to
// Supabase anyway to load/save your data.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  // Pass everything straight through to the network.
  event.respondWith(fetch(event.request));
});
