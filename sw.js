const APP_CACHE = "simtcg-app-v1";
const RUNTIME_CACHE = "simtcg-runtime-v1";
const APP_SHELL = [
  "./",
  "index.html",
  "game.html",
  "profile.html",
  "styles.css",
  "game.css",
  "profile.css",
  "app.js",
  "game.js",
  "profile.js",
  "catalog/constants.js",
  "game/constants.js",
  "firebase/config.js",
  "firebase/storage.js",
  "offline/offline.js",
];

async function installAppShell() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_SHELL);
}

self.addEventListener("install", (event) => {
  event.waitUntil(installAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![APP_CACHE, RUNTIME_CACHE, "simtcg-manual-v1"].includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function isSameOrigin(request) {
  try {
    const reqUrl = new URL(request.url);
    return reqUrl.origin === self.location.origin;
  } catch {
    return false;
  }
}

function isTcgdexRequest(request) {
  try {
    const reqUrl = new URL(request.url);
    return reqUrl.hostname === "api.tcgdex.net" || reqUrl.hostname === "assets.tcgdex.net";
  } catch {
    return false;
  }
}

async function networkFirst(request, fallback = null) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      runtime.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await runtime.match(request);
    if (cached) {
      return cached;
    }
    if (fallback) {
      const appCache = await caches.open(APP_CACHE);
      const fallbackResponse = await appCache.match(fallback);
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    throw new Error("offline");
  }
}

async function cacheFirst(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response) {
    runtime.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "index.html"));
    return;
  }

  if (isTcgdexRequest(request)) {
    const destination = request.destination || "";
    if (destination === "image") {
      event.respondWith(cacheFirst(request));
      return;
    }
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin(request)) {
    event.respondWith((async () => {
      const appCache = await caches.open(APP_CACHE);
      const appCached = await appCache.match(request);
      if (appCached) {
        return appCached;
      }
      return cacheFirst(request);
    })());
  }
});
