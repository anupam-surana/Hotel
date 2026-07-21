// Minimal PWA service worker.
//
// Deliberately does NOT cache API routes, Server Action POSTs, or dynamic
// pages — this app deals in live room availability and payments, so serving
// stale data would be actively harmful. It only does two things:
//   1. Cache-first for hashed, versioned static assets (fast repeat loads).
//   2. Network-first for page navigations, falling back to a static
//      offline page when there's no connection at all.

const STATIC_CACHE = "hotel-pms-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return; // never intercept POSTs (Server Actions, API mutations)
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  const isVersionedAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/");

  if (isVersionedAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
