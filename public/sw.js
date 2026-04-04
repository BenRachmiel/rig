const AUDIO_CACHE = "reverb-audio-v1";
const META_CACHE = "reverb-meta-v1";

// Endpoints that serve binary audio data — cache-first strategy.
const AUDIO_PATHS = ["/api/reverb/stream"];

// Metadata endpoints — network-first with cache fallback.
const META_PATHS = [
  "/api/reverb/getAlbum",
  "/api/reverb/getRandomSongs",
  "/api/reverb/getStarred2",
  "/api/reverb/search3",
  "/api/reverb/getLyricsBySongId",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== AUDIO_CACHE && k !== META_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const path = url.pathname;

  if (AUDIO_PATHS.some((p) => path.startsWith(p))) {
    e.respondWith(audioCacheFirst(e.request));
    return;
  }

  if (META_PATHS.some((p) => path.startsWith(p))) {
    e.respondWith(networkFirstMeta(e.request));
    return;
  }

  // All other requests — pass through.
});

/**
 * Cache-first for audio streams.
 * Handles Range requests from cache by slicing the cached ArrayBuffer.
 */
async function audioCacheFirst(request) {
  const cache = await caches.open(AUDIO_CACHE);

  // Use a cache key without Range header (store full response).
  const cacheKey = new Request(request.url, { method: "GET", headers: {} });
  const cached = await cache.match(cacheKey);

  if (cached) {
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      return serveRangeFromCache(cached, rangeHeader);
    }
    return cached;
  }

  // Not cached — fetch from network.
  try {
    const response = await fetch(request);
    if (response.ok && isAudioResponse(response)) {
      // Store the full response (clone before consuming).
      const cloned = response.clone();
      cache.put(cacheKey, cloned);
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

/**
 * Serve a Range request from a cached full response.
 */
async function serveRangeFromCache(cached, rangeHeader) {
  const buffer = await cached.arrayBuffer();
  const total = buffer.byteLength;
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);

  if (!match) {
    return new Response(buffer, {
      status: 200,
      headers: cached.headers,
    });
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : total - 1;
  const clampedEnd = Math.min(end, total - 1);

  if (start > clampedEnd || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  const slice = buffer.slice(start, clampedEnd + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${clampedEnd}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

/**
 * Network-first for metadata — falls back to cache when offline.
 */
async function networkFirstMeta(request) {
  const cache = await caches.open(META_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function isAudioResponse(response) {
  const ct = response.headers.get("Content-Type") || "";
  return ct.includes("audio") || ct.includes("octet-stream");
}

// PostMessage API for main-thread cache management.
self.addEventListener("message", (e) => {
  const { type, urls, url } = e.data || {};

  switch (type) {
    case "PRE_CACHE":
      if (Array.isArray(urls)) {
        preCacheUrls(urls).then(() => {
          e.source?.postMessage({ type: "PRE_CACHE_DONE" });
        });
      }
      break;

    case "EVICT":
      if (url) {
        caches.open(AUDIO_CACHE).then((cache) => cache.delete(url));
      }
      break;

    case "CACHE_SIZE":
      getCacheSize().then((size) => {
        e.source?.postMessage({ type: "CACHE_SIZE_RESULT", size });
      });
      break;

    case "CLEAR_CACHE":
      caches.delete(AUDIO_CACHE).then(() => {
        caches.delete(META_CACHE).then(() => {
          e.source?.postMessage({ type: "CLEAR_CACHE_DONE" });
        });
      });
      break;
  }
});

async function preCacheUrls(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  for (const url of urls) {
    const existing = await cache.match(url);
    if (existing) continue;
    try {
      const response = await fetch(url);
      if (response.ok && isAudioResponse(response)) {
        await cache.put(url, response);
      }
    } catch {
      // Skip failed pre-cache — non-critical.
    }
  }
}

async function getCacheSize() {
  let total = 0;
  for (const name of [AUDIO_CACHE, META_CACHE]) {
    try {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const req of keys) {
        const res = await cache.match(req);
        if (res) {
          const cl = res.headers.get("Content-Length");
          if (cl) {
            total += parseInt(cl, 10);
          } else {
            const buf = await res.clone().arrayBuffer();
            total += buf.byteLength;
          }
        }
      }
    } catch {
      // Ignore cache read errors.
    }
  }
  return total;
}
