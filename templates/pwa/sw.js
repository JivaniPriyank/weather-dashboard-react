/* Caches only the app's design and script files (their names change with every
   build), so pages always show fresh, private data. */
const CACHE = "germanlab-static-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/static/app/assets/")) return;
  e.respondWith(caches.open(CACHE).then((cache) => cache.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  }))));
});
