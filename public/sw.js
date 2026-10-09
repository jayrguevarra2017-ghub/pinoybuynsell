/* Cache only the static offline screen and its logo. All marketplace data stays online. */
const APP_CACHE = "pinoybuynsell-offline-v1";
const OFFLINE_ASSETS = ["/offline.html", "/branding/pinoybuynsell-facebook-profile.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("pinoybuynsell-offline-") && key !== APP_CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache or intercept API calls, uploads, bids, messages, auth or private documents.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => {
      const offline = await caches.match("/offline.html");
      return offline || new Response("Reconnect to open PinoyBuyNSell.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }));
  } else if (!url.search && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)));
  }
});
