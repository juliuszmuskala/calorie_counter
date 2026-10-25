// Offline support. The app shell is cached on first load; the Open Food Facts API is never cached.
// The build fills in the file list and a build id below (see vite.config.js), so each deploy gets a fresh cache.
const CACHE = 'calorie-counter-mvnrucu9';
const PRECACHE = ["./","manifest.webmanifest","icon-192.png","icon.svg","assets/index-UwO8myL3.js","assets/ciqual-DNBC-paR.js","assets/confetti.module-D2UmBLOm.js","assets/ponyfill-F58X_nWR.js","assets/zxing_reader-BwrG5lKu.js","assets/index-C32q9xka.css","assets/zxing_reader-BCjuyud6.wasm","index.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;

  if (request.mode === 'navigate') {
    // network first so a new deploy shows up, cached page when offline
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // hashed build assets never change, fonts rarely do: cache first
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
