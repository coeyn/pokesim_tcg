const SW_URL = "sw.js";
const APP_SHELL_URLS = [
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

const CARD_IMAGE_EXT = /\.(webp|png|jpe?g)$/i;

function toAbsolute(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return "";
  }
}

function normalizeImageUrl(raw) {
  if (!raw) {
    return "";
  }
  if (typeof raw === "string") {
    if (raw.startsWith("data:") || raw.startsWith("blob:")) {
      return "";
    }
    if (CARD_IMAGE_EXT.test(raw)) {
      return toAbsolute(raw);
    }
    return toAbsolute(`${raw}/high.webp`);
  }
  if (typeof raw === "object") {
    return toAbsolute(raw.high || raw.low || raw.small || "");
  }
  return "";
}

function collectDeckCardImageUrls() {
  const urls = new Set();
  try {
    const decks = JSON.parse(localStorage.getItem("simtcg.decks") || "[]");
    if (Array.isArray(decks)) {
      decks.forEach((deck) => {
        const cards = Array.isArray(deck?.cards) ? deck.cards : [];
        cards.forEach((card) => {
          const url = normalizeImageUrl(card?.image);
          if (url) {
            urls.add(url);
          }
        });
      });
    }
  } catch {
    // ignore malformed storage
  }

  try {
    const state = JSON.parse(localStorage.getItem("simtcg.currentGameState.v3") || "null");
    const gameCards = [
      ...(Array.isArray(state?.deck) ? state.deck : []),
      ...(Array.isArray(state?.hand) ? state.hand : []),
      ...(Array.isArray(state?.discard) ? state.discard : []),
      ...(Array.isArray(state?.placed) ? state.placed.map((item) => item?.card) : []),
    ];
    gameCards.forEach((card) => {
      const url = normalizeImageUrl(card?.image);
      if (url) {
        urls.add(url);
      }
    });
  } catch {
    // ignore malformed storage
  }

  return Array.from(urls);
}

async function cacheWithBestEffort(cache, url) {
  if (!url) {
    return;
  }
  try {
    const request = new Request(url, { mode: "no-cors", cache: "reload" });
    const response = await fetch(request);
    if (response) {
      await cache.put(request, response);
    }
  } catch {
    // Keep best-effort behavior; one bad URL must not block the whole action.
  }
}

export async function registerOfflineServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(SW_URL);
    return registration;
  } catch {
    return null;
  }
}

export async function cacheOfflinePack(extraUrls = []) {
  if (!("caches" in window)) {
    return { ok: false, count: 0 };
  }
  const cache = await caches.open("simtcg-manual-v1");
  const allUrls = new Set([
    ...APP_SHELL_URLS.map((url) => toAbsolute(url)),
    ...collectDeckCardImageUrls(),
    ...extraUrls.map((url) => toAbsolute(url)),
  ]);
  const urls = Array.from(allUrls).filter(Boolean);
  await Promise.all(urls.map((url) => cacheWithBestEffort(cache, url)));
  return { ok: true, count: urls.length };
}
