// PalaLab service worker — makes the app installable and usable offline.
// App-shell caching: network-first for navigations (so updates show up),
// cache-first for the hashed Vite /assets bundles and icons. Cross-origin
// requests (Google Fonts, Supabase) are left untouched so live features work
// online and fail gracefully offline.
const CACHE = "palalab-v2";
const ASSETS = [
  "/", "/index.html", "/site.webmanifest",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png",
  "/favicon.ico", "/favicon-32.png", "/favicon-16.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // don't touch fonts / Supabase / cross-origin

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Same-origin static assets: cache-first, populate on first fetch.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || ASSETS.includes(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"))
    )
  );
});
