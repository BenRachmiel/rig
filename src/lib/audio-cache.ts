const AUDIO_CACHE = "reverb-audio-v1";

function getSW(): ServiceWorker | null {
  return navigator.serviceWorker?.controller ?? null;
}

function postMessage(
  data: Record<string, unknown>,
): Promise<MessageEvent> {
  return new Promise((resolve) => {
    const sw = getSW();
    if (!sw) {
      resolve(new MessageEvent("message", { data: {} }));
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = resolve;
    sw.postMessage(data, [channel.port2]);
  });
}

export async function preCacheClips(urls: string[]): Promise<void> {
  const sw = getSW();
  if (!sw) return;
  sw.postMessage({ type: "PRE_CACHE", urls });
}

export async function evictClip(url: string): Promise<void> {
  const sw = getSW();
  if (!sw) return;
  sw.postMessage({ type: "EVICT", url });
}

export async function getCacheSize(): Promise<number> {
  const sw = getSW();
  if (!sw) return 0;
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "CACHE_SIZE_RESULT") {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(e.data.size ?? 0);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "CACHE_SIZE" });
    // Timeout fallback
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", handler);
      resolve(0);
    }, 3000);
  });
}

export async function clearCache(): Promise<void> {
  const sw = getSW();
  if (!sw) {
    await caches.delete(AUDIO_CACHE);
    return;
  }
  sw.postMessage({ type: "CLEAR_CACHE" });
}

export async function isAudioCached(url: string): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const match = await cache.match(url);
    return match !== undefined;
  } catch {
    return false;
  }
}
