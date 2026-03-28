"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { Clip } from "@/app/reverb/reducer";
import type { SongID3 } from "@/types/api";
import { reverbApi } from "@/lib/reverb-api";

export interface AudioEngineCallbacks {
  onClipEnd: () => void;
  onAlbumTrackChange: (index: number) => void;
  onAlbumEnd: () => void;
}

const TAPER_MS = 400;
const LOAD_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1_500, 3_000];

/** Wait for audio element to load metadata, with timeout and error handling. */
function waitForLoad(el: HTMLAudioElement, url: string, timeoutMs = LOAD_TIMEOUT_MS): Promise<void> {
  // Abort any in-progress load cleanly before starting a new one.
  // Setting src="" triggers an abort event for the old load; we drain it
  // with a no-op handler so it doesn't hit our real error listener.
  el.src = "";
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener("loadedmetadata", onLoad);
      el.removeEventListener("error", onError);
    };
    const onLoad = () => { cleanup(); resolve(); };
    const onError = () => {
      cleanup();
      const code = el.error?.code;
      // MEDIA_ERR_ABORTED (code 1) from the src="" reset — ignore
      if (code === MediaError.MEDIA_ERR_ABORTED) {
        resolve(); // will be retried or superseded
        return;
      }
      const msg = el.error?.message ?? "unknown";
      reject(new Error(`Audio load failed (code=${code}): ${msg}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Audio load timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    el.addEventListener("loadedmetadata", onLoad, { once: true });
    el.addEventListener("error", onError, { once: true });
    el.src = url;
  });
}

/** Load with retry + exponential backoff. Aborts if generation changes (new load started). */
async function loadWithRetry(
  el: HTMLAudioElement,
  url: string,
  genRef: { current: number },
  gen: number,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (genRef.current !== gen) throw new Error("aborted");
    try {
      await waitForLoad(el, url);
      return;
    } catch (err) {
      if (genRef.current !== gen) throw new Error("aborted");
      if (attempt === MAX_RETRIES) throw err;
      await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
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
  const [loadError, setLoadError] = useState<string | null>(null);

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
    a.preload = "auto";
    b.preload = "auto";
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

    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    gainA.connect(analyser);
    gainB.connect(analyser);
    gainARef.current = gainA;
    gainBRef.current = gainB;
    gainA.gain.value = 1;
    gainB.gain.value = 0;

    if (audioA.current && !sourceARef.current) {
      sourceARef.current = ctx.createMediaElementSource(audioA.current);
      sourceARef.current.connect(gainA);
    }
    if (audioB.current && !sourceBRef.current) {
      sourceBRef.current = ctx.createMediaElementSource(audioB.current);
      sourceBRef.current.connect(gainB);
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

  const frameCount = useRef(0);

  const startProgressTracking = useCallback(() => {
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    frameCount.current = 0;

    const tick = () => {
      const el = getActive();
      if (!el) return;

      if (modeRef.current === "clip" && clipRef.current) {
        const clip = clipRef.current;
        const elapsed = el.currentTime - clip.seekOffset;

        if (elapsed >= clip.duration) {
          stopProgressTracking();
          setIsPlaying(false);
          cbRef.current.onClipEnd();
          return;
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

      // Taper out old clip if one was playing
      if (wasPlaying) {
        const oldGain = getActiveGain();
        if (oldGain) {
          const now = ctx.currentTime;
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(oldGain.gain.value, now);
          oldGain.gain.linearRampToValueAtTime(0, now + TAPER_MS / 1000);
        }
        const oldEl = getActive();
        // Stop old element after taper
        if (taperTimerRef.current) clearTimeout(taperTimerRef.current);
        taperTimerRef.current = setTimeout(() => { oldEl?.pause(); }, TAPER_MS);
      }

      // Swap to the other element
      const nextSide: "a" | "b" = activeRef.current === "a" ? "b" : "a";
      activeRef.current = nextSide;

      modeRef.current = "clip";
      clipRef.current = clip;
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);

      const gen = ++loadGenRef.current;
      const streamUrl = reverbApi.streamUrl(clip.song.id);
      const el = getActive()!;
      const inGain = getActiveGain();

      setIsBuffering(true);
      setLoadError(null);
      try {
        await loadWithRetry(el, streamUrl, loadGenRef, gen);
      } catch (err) {
        setIsBuffering(false);
        if (loadGenRef.current !== gen) return; // superseded by newer load
        setLoadError(err instanceof Error ? err.message : "Load failed");
        cbRef.current.onClipEnd();
        return;
      }
      if (loadGenRef.current !== gen) return; // superseded
      setIsBuffering(false);
      el.currentTime = clip.seekOffset;

      // Taper in: start silent, ramp to 1
      if (inGain) {
        const now = ctx.currentTime;
        inGain.gain.cancelScheduledValues(now);
        inGain.gain.setValueAtTime(0, now);
        inGain.gain.linearRampToValueAtTime(1, now + TAPER_MS / 1000);
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
    [ensureAudioContext, getActive, getActiveGain, startProgressTracking, stopProgressTracking],
  );

  const preloadClip = useCallback(
    (clip: Clip) => {
      // Preload on whichever element is NOT active
      const el = activeRef.current === "a" ? audioB.current : audioA.current;
      if (!el) return;
      const url = reverbApi.streamUrl(clip.song.id);
      el.src = url;
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (el.src.includes(clip.song.id)) {
            el.currentTime = clip.seekOffset;
          }
        },
        { once: true },
      );
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

        try {
          await loadWithRetry(el, reverbApi.streamUrl(songs[idx].id), loadGenRef, gen);
        } catch {
          if (loadGenRef.current !== gen) return;
          await playTrack(idx + 1);
          return;
        }
        if (loadGenRef.current !== gen) return;
        el.currentTime = 0;
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
    [ensureAudioContext, getActive, resetGains, startProgressTracking, stopProgressTracking],
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

      const song = albumSongsRef.current[index];
      try {
        await loadWithRetry(el, reverbApi.streamUrl(song.id), loadGenRef, gen);
      } catch {
        if (loadGenRef.current !== gen) return;
        const next = albumIndexRef.current + 1;
        if (next >= albumSongsRef.current.length) {
          setIsPlaying(false);
          stopProgressTracking();
          cbRef.current.onAlbumEnd();
          return;
        }
        playAlbumTrack(next);
        return;
      }
      if (loadGenRef.current !== gen) return;
      el.currentTime = 0;
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
    [getActive, startProgressTracking, stopProgressTracking],
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
    loadError,
    progress,
    albumTrackIndex,
    analyserNode,
  };
}
