const CACHE = "kasir-shell-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

const cacheable = (url) => (url.origin === self.location.origin || url.hostname.includes("fonts.g")) &&
  !url.pathname.startsWith("/api") && !url.pathname.includes("hot-update") && !url.pathname.startsWith("/ws") && !url.pathname.includes("sockjs");

self.addEventListener("message", (e) => {
  if (e.data?.type !== "precache") return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    e.data.urls.filter((u) => cacheable(new URL(u, self.location.origin))).map((u) => c.add(u).catch(() => {}))
  )));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  const key = req.mode === "navigate" ? "/" : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then((r) => r || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })))
  );
});
