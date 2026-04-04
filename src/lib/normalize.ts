const DB_NAME = "reverb-meta";
const STORE_NAME = "normalization";
const DB_VERSION = 1;

/** Target RMS in linear amplitude (~-18 dBFS) */
const TARGET_RMS = 0.125;
const GAIN_MIN = 0.25;
const GAIN_MAX = 4.0;

interface NormEntry {
  songId: string;
  gainValue: number;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "songId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve pre-computed gain for a song. Returns null if not computed. */
export async function getStoredGain(songId: string): Promise<number | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(songId);
      req.onsuccess = () => {
        const entry = req.result as NormEntry | undefined;
        resolve(entry?.gainValue ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Store pre-computed gain for a song. */
async function storeGain(songId: string, gainValue: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: NormEntry = { songId, gainValue, cachedAt: Date.now() };
    store.put(entry);
  } catch {
    // Best-effort storage.
  }
}

/**
 * Compute normalization gain from an ArrayBuffer of audio data.
 * Decodes to PCM and measures RMS. Stores result in IndexedDB.
 */
export async function computeGainFromBuffer(
  cacheKey: string,
  buffer: ArrayBuffer,
): Promise<number> {
  const existing = await getStoredGain(cacheKey);
  if (existing !== null) return existing;

  try {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audioBuffer = await ctx.decodeAudioData(buffer);

    let sumSq = 0;
    let totalSamples = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        sumSq += data[i] * data[i];
      }
      totalSamples += data.length;
    }

    const rms = Math.sqrt(sumSq / totalSamples);
    if (rms < 0.0001) {
      await storeGain(cacheKey, 1);
      return 1;
    }

    const gain = Math.min(GAIN_MAX, Math.max(GAIN_MIN, TARGET_RMS / rms));
    await storeGain(cacheKey, gain);
    return gain;
  } catch {
    await storeGain(cacheKey, 1);
    return 1;
  }
}

/** Cache key for normalization: clip segments get a separate key from full songs. */
export function normCacheKey(songId: string, isClip: boolean): string {
  return isClip ? `${songId}:clip` : songId;
}

/**
 * Fetch audio as ArrayBuffer (single download). Returns both the buffer
 * (for normalization) and a blob URL (for the <audio> element).
 */
export async function fetchAudioBuffer(url: string): Promise<{ buffer: ArrayBuffer; blobUrl: string }> {
  let buffer: ArrayBuffer;
  let contentType = "audio/mpeg"; // fallback
  if ("caches" in window) {
    const cache = await caches.open("reverb-audio-v1");
    const cached = await cache.match(url);
    if (cached) {
      contentType = cached.headers.get("content-type") ?? contentType;
      buffer = await cached.clone().arrayBuffer();
    } else {
      const res = await fetch(url);
      contentType = res.headers.get("content-type") ?? contentType;
      buffer = await res.arrayBuffer();
    }
  } else {
    const res = await fetch(url);
    contentType = res.headers.get("content-type") ?? contentType;
    buffer = await res.arrayBuffer();
  }
  const blob = new Blob([buffer], { type: contentType });
  const blobUrl = URL.createObjectURL(blob);
  return { buffer, blobUrl };
}
