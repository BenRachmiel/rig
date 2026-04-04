"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { Clip } from "@/app/reverb/reducer";
import type { SongID3 } from "@/types/api";
import { reverbApi } from "@/lib/reverb-api";
import { useSettingsStore } from "@/stores/settings-store";
import { computeGainFromBuffer, fetchAudioBuffer, normCacheKey, getStoredGain } from "@/lib/normalize";

export interface AudioEngineCallbacks {
  onClipEnd: () => void;
  onCrossfadeStart: () => void;
  onAlbumTrackChange: (index: number) => void;
  onAlbumEnd: () => void;
}

const TAPER_MS = 400;
const CROSSFADE_S = 2;

const LOAD_TIMEOUT_MS = 8_000;

/** Wait for audio element to load metadata, with timeout and error handling. */
function waitForLoad(el: HTMLAudioElement, url: string, timeoutMs = LOAD_TIMEOUT_MS): Promise<void> {
  // Synchronously reset + drain: pause, wipe src, flush via load().
  // Then wait a microtask so any queued abort/error events from the
  // reset fire and clear before we attach our real listeners.
  el.pause();
  el.removeAttribute("src");
  el.load();

  return new Promise<void>((resolve) => setTimeout(resolve, 0))
    .then(() => new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        el.removeEventListener("canplay", onLoad);
        el.removeEventListener("error", onError);
      };
      const onLoad = () => { cleanup(); resolve(); };
      const onError = () => {
        cleanup();
        const msg = el.error?.message ?? "unknown";
        reject(new Error(`Audio load failed (code=${el.error?.code}): ${msg}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Audio load timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      el.addEventListener("canplay", onLoad, { once: true });
      el.addEventListener("error", onError, { once: true });
      el.src = url;
      el.load();
    }));
}


export function useAudioEngine(callbacks: AudioEngineCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const audioA = useRef<HTMLAudioElement | null>(null);
  const audioB = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<"a" | "b">("a");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  /** Per-element normalization gain applied on top of taper gain */
  const normGainARef = useRef<GainNode | null>(null);
  const normGainBRef = useRef<GainNode | null>(null);

  const crossfadeFiredRef = useRef(false);
  const crossfadingRef = useRef(false);

  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipRef = useRef<Clip | null>(null);
  const albumSongsRef = useRef<SongID3[]>([]);
  const albumIndexRef = useRef(0);
  const modeRef = useRef<"clip" | "album" | "idle">("idle");
  const loadGenRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [albumTrackIndex, setAlbumTrackIndex] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const normalizationEnabled = useSettingsStore((s) => s.normalizationEnabled);
  const normalizationRef = useRef(normalizationEnabled);
  normalizationRef.current = normalizationEnabled;

  const setNormalizationEnabled = useCallback((enabled: boolean) => {
    useSettingsStore.getState().set("normalizationEnabled", enabled);
    // When toggling off, reset normalization gains to unity
    if (!enabled) {
      const ctx = audioCtxRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        for (const ref of [normGainARef, normGainBRef]) {
          if (ref.current) {
            ref.current.gain.cancelScheduledValues(now);
            ref.current.gain.setValueAtTime(1, now);
          }
        }
      }
    }
  }, []);

  const progressRafRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    if (wakeLockRef.current || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
    } catch { /* user denied or not supported */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    const a = new Audio();
    const b = new Audio();
    a.preload = "none";
    b.preload = "none";
    audioA.current = a;
    audioB.current = b;

    return () => {
      a.pause();
      b.pause();
      a.src = "";
      b.src = "";
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      if (taperTimerRef.current) clearTimeout(taperTimerRef.current);
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      audioCtxRef.current?.close();
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Acquire/release wake lock based on playback state
  useEffect(() => {
    if (isPlaying) acquireWakeLock();
    else releaseWakeLock();
  }, [isPlaying, acquireWakeLock, releaseWakeLock]);

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(ctx.destination);

    // Audio graph: source → normGain → taperGain → visualAnalyser → destination
    // normGain holds the per-song volume offset (pre-computed from full decode)
    // taperGain handles crossfade/taper ramps
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const normGainA = ctx.createGain();
    const normGainB = ctx.createGain();

    gainARef.current = gainA;
    gainBRef.current = gainB;
    normGainARef.current = normGainA;
    normGainBRef.current = normGainB;
    gainA.gain.value = 1;
    gainB.gain.value = 0;
    normGainA.gain.value = 1;
    normGainB.gain.value = 1;

    normGainA.connect(gainA);
    normGainB.connect(gainB);
    gainA.connect(analyser);
    gainB.connect(analyser);

    if (audioA.current && !sourceARef.current) {
      sourceARef.current = ctx.createMediaElementSource(audioA.current);
      sourceARef.current.connect(normGainA);
    }
    if (audioB.current && !sourceBRef.current) {
      sourceBRef.current = ctx.createMediaElementSource(audioB.current);
      sourceBRef.current.connect(normGainB);
    }

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    setAnalyserNode(analyser);
  }, []);

  const getActive = useCallback(
    () => (activeRef.current === "a" ? audioA.current : audioB.current),
    [],
  );
  const getActiveGain = useCallback(
    () => (activeRef.current === "a" ? gainARef.current : gainBRef.current),
    [],
  );
  const getActiveNormGain = useCallback(
    () => (activeRef.current === "a" ? normGainARef.current : normGainBRef.current),
    [],
  );
  const resetGains = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const ref of [gainARef, gainBRef]) {
      if (ref.current) {
        ref.current.gain.cancelScheduledValues(now);
      }
    }
    const aGain = activeRef.current === "a" ? gainARef.current : gainBRef.current;
    const bGain = activeRef.current === "a" ? gainBRef.current : gainARef.current;
    if (aGain) aGain.gain.value = 1;
    if (bGain) bGain.gain.value = 0;
  }, []);

  /** Apply pre-computed normalization gain from an audio buffer. */
  const applyNormGain = useCallback(async (cacheKey: string, buffer: ArrayBuffer): Promise<void> => {
    if (!normalizationRef.current) return;
    const gain = await computeGainFromBuffer(cacheKey, buffer);
    const normGain = getActiveNormGain();
    if (normGain) normGain.gain.value = gain;
  }, [getActiveNormGain]);

  const frameCount = useRef(0);

  const startProgressTracking = useCallback(() => {
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    frameCount.current = 0;

    const tick = () => {
      const el = getActive();
      if (!el) return;

      if (modeRef.current === "clip" && clipRef.current) {
        const clip = clipRef.current;
        const elapsed = el.currentTime;

        if (elapsed >= clip.duration) {
          stopProgressTracking();
          setIsPlaying(false);
          cbRef.current.onClipEnd();
          return;
        }

        // Fire crossfade callback when approaching end (short clips skip crossfade)
        if (
          !crossfadeFiredRef.current &&
          clip.duration > CROSSFADE_S * 2 &&
          elapsed >= clip.duration - CROSSFADE_S
        ) {
          crossfadeFiredRef.current = true;
          cbRef.current.onCrossfadeStart();
        }

        // Throttle React state updates to ~15fps (every 4th frame at 60hz)
        if (++frameCount.current % 4 === 0) {
          setProgress(Math.min(1, Math.max(0, elapsed / clip.duration)));
        }
      } else if (modeRef.current === "album") {
        const dur = el.duration;

        if (dur && isFinite(dur) && ++frameCount.current % 4 === 0) {
          setProgress(el.currentTime / dur);
        }
      }

      progressRafRef.current = requestAnimationFrame(tick);
    };

    progressRafRef.current = requestAnimationFrame(tick);
  }, [getActive]);

  const stopProgressTracking = useCallback(() => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const playClip = useCallback(
    async (clip: Clip) => {
      ensureAudioContext();
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      const ctx = audioCtxRef.current!;
      const wasPlaying = modeRef.current === "clip";
      const useClipCrossfade = wasPlaying && clip.duration > CROSSFADE_S * 2;
      const taperMs = useClipCrossfade ? CROSSFADE_S * 1000 : TAPER_MS;

      // Taper out old clip if one was playing
      if (wasPlaying) {
        const oldGain = getActiveGain();
        if (oldGain) {
          const now = ctx.currentTime;
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(oldGain.gain.value, now);
          oldGain.gain.exponentialRampToValueAtTime(0.001, now + taperMs / 1000);
        }
        const oldEl = getActive();
        if (taperTimerRef.current) clearTimeout(taperTimerRef.current);
        taperTimerRef.current = setTimeout(() => {
          oldEl?.pause();
          crossfadingRef.current = false;
          setIsCrossfading(false);
        }, taperMs);

        if (useClipCrossfade) {
          crossfadingRef.current = true;
          setIsCrossfading(true);
        }
      }

      // Swap to the other element
      const nextSide: "a" | "b" = activeRef.current === "a" ? "b" : "a";
      activeRef.current = nextSide;

      modeRef.current = "clip";
      clipRef.current = clip;
      crossfadeFiredRef.current = false;
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);

      const gen = ++loadGenRef.current;
      const streamUrl = reverbApi.streamUrl(clip.song.id, clip.seekOffset, clip.duration);
      const el = getActive()!;
      const inGain = getActiveGain();

      // Reset normalization gain for new clip
      const normGainNode = getActiveNormGain();
      if (normGainNode) normGainNode.gain.value = 1;

      setIsBuffering(true);
      setLoadError(null);

      // Single fetch: download once, use for both normalization and playback
      let blobUrl: string;
      try {
        const { buffer, blobUrl: url } = await fetchAudioBuffer(streamUrl);
        blobUrl = url;
        if (loadGenRef.current !== gen) { URL.revokeObjectURL(url); return; }

        setIsBuffering(false);

        // Compute normalization from the already-downloaded buffer
        const isClip = streamUrl.includes("startTime");
        setIsNormalizing(true);
        await applyNormGain(normCacheKey(clip.song.id, isClip), buffer);
        setIsNormalizing(false);
        if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }
      } catch (err) {
        setIsBuffering(false);
        setIsNormalizing(false);
        if (loadGenRef.current !== gen) return;
        setLoadError(err instanceof Error ? err.message : "Load failed");
        cbRef.current.onClipEnd();
        return;
      }

      // Load blob URL into the audio element (already in memory — near-instant)
      try {
        await waitForLoad(el, blobUrl);
      } catch (err) {
        URL.revokeObjectURL(blobUrl);
        if (loadGenRef.current !== gen) return;
        setLoadError(err instanceof Error ? err.message : "Load failed");
        cbRef.current.onClipEnd();
        return;
      }
      if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }

      // Taper in: start silent, ramp to 1
      if (inGain) {
        const now = ctx.currentTime;
        inGain.gain.cancelScheduledValues(now);
        inGain.gain.setValueAtTime(0.001, now);
        inGain.gain.exponentialRampToValueAtTime(1, now + taperMs / 1000);
      }

      await el.play();
      setIsPlaying(true);
      setProgress(0);
      startProgressTracking();

      // Fallback timer for background tabs
      clipTimerRef.current = setTimeout(() => {
        if (modeRef.current === "clip") {
          stopProgressTracking();
          setIsPlaying(false);
          cbRef.current.onClipEnd();
        }
      }, clip.duration * 1000 + 500);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Discovering...",
          artist: "Reverb",
        });
        navigator.mediaSession.setActionHandler("play", () => resume());
        navigator.mediaSession.setActionHandler("pause", () => pause());
        navigator.mediaSession.setActionHandler("nexttrack", () => cbRef.current.onClipEnd());
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    },
    [ensureAudioContext, getActive, getActiveGain, getActiveNormGain, applyNormGain, startProgressTracking, stopProgressTracking],
  );

  const preloadClip = useCallback(
    (clip: Clip) => {
      // Don't preload during crossfade — would abort the fading-out element
      if (crossfadingRef.current) return;
      // Preload on whichever element is NOT active
      const el = activeRef.current === "a" ? audioB.current : audioA.current;
      if (!el) return;
      el.src = reverbApi.streamUrl(clip.song.id, clip.seekOffset, clip.duration);
      el.load();
    },
    [],
  );

  const playAlbum = useCallback(
    async (songs: SongID3[], startIndex: number) => {
      ensureAudioContext();
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      modeRef.current = "album";
      albumSongsRef.current = songs;
      albumIndexRef.current = startIndex;
      const gen = ++loadGenRef.current;

      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      if (taperTimerRef.current) clearTimeout(taperTimerRef.current);

      // Reset gains for album mode
      resetGains();

      const el = getActive()!;

      const playTrack = async (idx: number) => {
        if (idx >= songs.length) {
          setIsPlaying(false);
          stopProgressTracking();
          cbRef.current.onAlbumEnd();
          return;
        }

        albumIndexRef.current = idx;
        setAlbumTrackIndex(idx);
        cbRef.current.onAlbumTrackChange(idx);

        // Reset normalization for new track
        const normGainNode = getActiveNormGain();
        if (normGainNode) normGainNode.gain.value = 1;

        const streamUrl = reverbApi.streamUrl(songs[idx].id);
        setIsBuffering(true);

        let blobUrl: string;
        try {
          const { buffer, blobUrl: url } = await fetchAudioBuffer(streamUrl);
          blobUrl = url;
          if (loadGenRef.current !== gen) { URL.revokeObjectURL(url); return; }
          setIsBuffering(false);

          setIsNormalizing(true);
          await applyNormGain(normCacheKey(songs[idx].id, false), buffer);
          setIsNormalizing(false);
          if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }
        } catch {
          setIsBuffering(false);
          setIsNormalizing(false);
          if (loadGenRef.current !== gen) return;
          await playTrack(idx + 1);
          return;
        }

        try {
          await waitForLoad(el, blobUrl);
        } catch {
          URL.revokeObjectURL(blobUrl);
          if (loadGenRef.current !== gen) return;
          await playTrack(idx + 1);
          return;
        }
        if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }

        await el.play();
        setIsPlaying(true);
        setProgress(0);
        startProgressTracking();

        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: songs[idx].title,
            artist: songs[idx].artist,
            album: songs[idx].album,
          });
          navigator.mediaSession.setActionHandler("play", () => resume());
          navigator.mediaSession.setActionHandler("pause", () => pause());
          navigator.mediaSession.setActionHandler("nexttrack", () =>
            playTrack(albumIndexRef.current + 1),
          );
          navigator.mediaSession.setActionHandler("previoustrack", () =>
            playTrack(Math.max(0, albumIndexRef.current - 1)),
          );
        }
      };

      el.onended = () => playTrack(albumIndexRef.current + 1);
      await playTrack(startIndex);
    },
    [ensureAudioContext, getActive, getActiveNormGain, resetGains, applyNormGain, startProgressTracking, stopProgressTracking],
  );

  const playAlbumTrack = useCallback(
    async (index: number) => {
      if (modeRef.current !== "album") return;
      const gen = ++loadGenRef.current;
      const el = getActive()!;
      el.onended = () => {
        const next = albumIndexRef.current + 1;
        if (next >= albumSongsRef.current.length) {
          setIsPlaying(false);
          stopProgressTracking();
          cbRef.current.onAlbumEnd();
          return;
        }
        playAlbumTrack(next);
      };

      albumIndexRef.current = index;
      setAlbumTrackIndex(index);
      cbRef.current.onAlbumTrackChange(index);

      // Reset normalization for new track
      const normGainNode = getActiveNormGain();
      if (normGainNode) normGainNode.gain.value = 1;

      const song = albumSongsRef.current[index];
      const streamUrl = reverbApi.streamUrl(song.id);
      setIsBuffering(true);

      const skipToNext = () => {
        const next = albumIndexRef.current + 1;
        if (next >= albumSongsRef.current.length) {
          setIsPlaying(false);
          stopProgressTracking();
          cbRef.current.onAlbumEnd();
          return;
        }
        playAlbumTrack(next);
      };

      let blobUrl: string;
      try {
        const { buffer, blobUrl: url } = await fetchAudioBuffer(streamUrl);
        blobUrl = url;
        if (loadGenRef.current !== gen) { URL.revokeObjectURL(url); return; }
        setIsBuffering(false);

        setIsNormalizing(true);
        await applyNormGain(normCacheKey(song.id, false), buffer);
        setIsNormalizing(false);
        if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }
      } catch {
        setIsBuffering(false);
        setIsNormalizing(false);
        if (loadGenRef.current !== gen) return;
        skipToNext();
        return;
      }

      try {
        await waitForLoad(el, blobUrl);
      } catch {
        URL.revokeObjectURL(blobUrl);
        if (loadGenRef.current !== gen) return;
        skipToNext();
        return;
      }
      if (loadGenRef.current !== gen) { URL.revokeObjectURL(blobUrl); return; }

      await el.play();
      setIsPlaying(true);
      setProgress(0);
      startProgressTracking();

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: song.album,
        });
      }
    },
    [getActive, getActiveNormGain, applyNormGain, startProgressTracking, stopProgressTracking],
  );

  const pause = useCallback(() => {
    getActive()?.pause();
    setIsPlaying(false);
    stopProgressTracking();
  }, [getActive, stopProgressTracking]);

  const resume = useCallback(async () => {
    const el = getActive();
    if (!el) return;
    if (audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    await el.play();
    setIsPlaying(true);
    startProgressTracking();
  }, [getActive, startProgressTracking]);

  const stop = useCallback(() => {
    const a = audioA.current;
    const b = audioB.current;
    a?.pause();
    b?.pause();
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    if (taperTimerRef.current) clearTimeout(taperTimerRef.current);
    stopProgressTracking();
    resetGains();
    crossfadingRef.current = false;
    setIsCrossfading(false);
    modeRef.current = "idle";
    setIsPlaying(false);
    setProgress(0);
  }, [stopProgressTracking, resetGains]);

  return {
    playClip,
    preloadClip,
    playAlbum,
    playAlbumTrack,
    pause,
    resume,
    stop,
    isPlaying,
    isBuffering,
    isNormalizing,
    loadError,
    progress,
    albumTrackIndex,
    analyserNode,
    isCrossfading,
    normalizationEnabled,
    setNormalizationEnabled,
  };
}
