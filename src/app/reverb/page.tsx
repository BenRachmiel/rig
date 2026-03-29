"use client";

import { Suspense, useReducer, useEffect, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { reverbReducer, initialState, makeClip } from "./reducer";
import { usePlayback } from "@/contexts/playback-context";
import { usePlaybackStore } from "@/stores/playback-store";
import { useAudioReactivity } from "@/hooks/use-audio-reactivity";
import { reverbApi } from "@/lib/reverb-api";
import { ClipUI } from "@/components/reverb/clip-ui";
import { AlbumUI } from "@/components/reverb/album-ui";
import { RevealUI } from "@/components/reverb/reveal-ui";

export default function ReverbPage() {
  return (
    <Suspense>
      <ReverbPageInner />
    </Suspense>
  );
}

function ReverbPageInner() {
  const [state, dispatch] = useReducer(reverbReducer, initialState);
  const fetchingRef = useRef(false);

  const searchParams = useSearchParams();
  const engine = usePlayback();
  const reactivityRef = useAudioReactivity(engine.analyserNode);
  const restoredRef = useRef(false);
  const directLoadRef = useRef(false);
  const lastDirectParamsRef = useRef<string>("");

  // Register Reverb-specific callbacks on mount, restore album if active, clean up on unmount
  useEffect(() => {
    engine.setCallbacks({
      onClipEnd: () => dispatch({ type: "SKIP" }),
      onAlbumTrackChange: (index) => dispatch({ type: "TRACK_CHANGE", index }),
      onAlbumEnd: () => dispatch({ type: "REVEAL" }),
    });
    usePlaybackStore.getState().hideMiniPlayer();

    // Restore album view if audio is still playing from a previous visit
    const { reverbAlbum, mode, isPlaying } = usePlaybackStore.getState();
    if (reverbAlbum && mode === "album" && isPlaying) {
      restoredRef.current = true;
      dispatch({ type: "RESTORE", album: reverbAlbum, trackIndex: engine.albumTrackIndex });
    }

    return () => engine.clearCallbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Direct album load from URL params (?artist=...&album=...)
  useEffect(() => {
    const artist = searchParams.get("artist");
    const album = searchParams.get("album");
    if (!artist || !album) return;

    // Deduplicate: skip if we already processed these exact params
    const paramsKey = `${artist}\0${album}`;
    if (paramsKey === lastDirectParamsRef.current) return;
    lastDirectParamsRef.current = paramsKey;

    // If something is already playing (restored or otherwise), stop it first
    if (restoredRef.current || state.phase === "album" || state.phase === "clip") {
      engine.stop();
      usePlaybackStore.getState().clearPlayback();
      restoredRef.current = false;
    }

    directLoadRef.current = true;
    dispatch({ type: "DIRECT_ALBUM_LOADING" });
    reverbApi
      .searchAlbum(artist, album)
      .then((found) => {
        if (found) dispatch({ type: "DIRECT_ALBUM", album: found });
        else dispatch({ type: "ERROR", message: `Album "${album}" by "${artist}" not found` });
      })
      .catch((e) =>
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : "Search failed" }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch pool
  const fetchPool = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const songs = await reverbApi.getRandomSongs(20);
      dispatch({ type: "POOL_LOADED", songs });
    } catch (e) {
      dispatch({ type: "ERROR", message: e instanceof Error ? e.message : "Failed to fetch songs" });
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (state.phase === "loading") fetchPool();
  }, [state.phase, fetchPool]);

  useEffect(() => {
    if (state.needsRefill) fetchPool();
  }, [state.needsRefill, fetchPool]);

  useEffect(() => {
    if (state.phase !== "clip" || !state.currentClip) return;
    engine.playClip(state.currentClip);

    // Preload N+1 via inactive audio element
    const nextIndex = state.poolIndex + 1;
    if (nextIndex < state.pool.length) {
      const nextClip = makeClip(state.pool[nextIndex]);
      engine.preloadClip(nextClip);
    }

    // Preload N+2 via fetch to prime HTTP cache
    const aheadIndex = state.poolIndex + 2;
    if (aheadIndex < state.pool.length) {
      const url = reverbApi.streamUrl(state.pool[aheadIndex].id);
      fetch(url, { priority: "low" } as RequestInit).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentClip]);

  useEffect(() => {
    // Direct loads fetch via searchAlbum, not via currentClip.albumId
    if (state.phase !== "album_loading" || !state.currentClip || directLoadRef.current) return;
    const albumId = state.currentClip.song.albumId;
    reverbApi
      .getAlbum(albumId)
      .then((album) => dispatch({ type: "ALBUM_LOADED", album }))
      .catch((e) =>
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : "Failed to load album" }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "album" || !state.album) return;
    // Skip if restored from persisted state — audio is already playing
    if (restoredRef.current) {
      restoredRef.current = false;
      return;
    }
    directLoadRef.current = false;
    engine.playAlbum(state.album.song, 0);

    usePlaybackStore.getState().startPlayback(
      {
        title: state.album.song[0]?.title ?? state.album.name,
        artist: state.album.artist,
        album: state.album.name,
      },
      "album",
      state.album,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.album]);

  useEffect(() => {
    if (state.phase !== "reveal" || !state.album) return;
    engine.stop();
    usePlaybackStore.getState().clearPlayback();
    for (const song of state.album.song) {
      reverbApi.scrobble(song.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Sync album track changes to playback store
  useEffect(() => {
    if (state.phase !== "album" || !state.album) return;
    const song = state.album.song[engine.albumTrackIndex];
    if (song) {
      usePlaybackStore.getState().setTrack({
        title: song.title,
        artist: song.artist,
        album: state.album.name,
      });
    }
  }, [engine.albumTrackIndex, state.phase, state.album]);

  const handlePauseToggle = useCallback(() => {
    if (engine.isPlaying) engine.pause();
    else engine.resume();
  }, [engine]);

  const handleSkip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const handleBack = useCallback(() => dispatch({ type: "BACK" }), []);
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const coverImgRef = useRef<HTMLImageElement | null>(null);

  const handleCommit = useCallback(() => {
    engine.stop();
    dispatch({ type: "COMMIT" });
    setCoverColor(null);

    // Cancel previous in-flight cover preload
    if (coverImgRef.current) coverImgRef.current.onload = null;

    if (state.currentClip) {
      const coverUrl = reverbApi.coverArtUrl(state.currentClip.song.albumId, 512);
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      coverImgRef.current = img;
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            setCoverColor(`rgb(${r},${g},${b})`);
          }
        } catch { /* tainted canvas is fine — art is still cached */ }
      };
      img.src = coverUrl;
    }
  }, [engine, state.currentClip]);
  const handleAbandon = useCallback(() => {
    engine.stop();
    usePlaybackStore.getState().clearPlayback();
    dispatch({ type: "ABANDON_ALBUM" });
  }, [engine]);
  const handleRestart = useCallback(() => dispatch({ type: "RESTART" }), []);

  const handleStart = handleRestart;

  return (
    <div
      ref={reactivityRef}
      className="relative bg-black text-white/90 overflow-hidden h-[100dvh] md:h-[calc(100dvh-3.5rem)]"
    >
      {/* Content */}
      <div className="flex flex-col items-center justify-center h-full px-6 max-w-sm md:max-w-md lg:max-w-lg mx-auto">
        {/* Idle */}
        {state.phase === "idle" && !state.error && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
            <span className="text-sm font-light tracking-[0.3em] uppercase opacity-40">
              reverb
            </span>
            <div className="w-12 h-px bg-white/20" />
            <button
              onClick={handleStart}
              className="text-xs tracking-[0.2em] uppercase opacity-30 hover:opacity-60 transition-opacity"
            >
              begin
            </button>
          </div>
        )}

        {/* Loading — clip pool fetch */}
        {state.phase === "loading" && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="size-1 rounded-full bg-white/30 animate-pulse" />
              <div className="size-1 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "150ms" }} />
              <div className="size-1 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-[10px] tracking-[0.2em] uppercase opacity-20">
              fetching clips
            </span>
          </div>
        )}

        {/* Loading — album metadata fetch (skeleton) */}
        {state.phase === "album_loading" && (
          <div className="flex flex-col items-center gap-5 w-full animate-in fade-in duration-300">
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-md bg-white/5 animate-pulse" />
            <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            <div className="h-2 w-20 rounded bg-white/5 animate-pulse" />
          </div>
        )}

        {/* Clip */}
        {state.phase === "clip" && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <ClipUI
              isPlaying={engine.isPlaying}
              isBuffering={engine.isBuffering}
              progress={engine.progress}
              onSkip={handleSkip}
              onBack={handleBack}
              onCommit={handleCommit}
              onPauseToggle={handlePauseToggle}
              analyserNode={engine.analyserNode}
              clipGeneration={state.poolIndex}
            />
          </div>
        )}

        {/* Album */}
        {state.phase === "album" && state.album && (
          <div className="w-full flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <AlbumUI
              album={state.album}
              currentTrackIndex={engine.albumTrackIndex}
              progress={engine.progress}
              isPlaying={engine.isPlaying}
              onPauseToggle={handlePauseToggle}
              onTrackSelect={(i) => engine.playAlbumTrack(i)}
              onNextTrack={() => engine.playAlbumTrack(engine.albumTrackIndex + 1)}
              onPrevTrack={() => engine.playAlbumTrack(Math.max(0, engine.albumTrackIndex - 1))}
              onAbandon={handleAbandon}
              analyserNode={engine.analyserNode}
            />
          </div>
        )}

        {/* Reveal */}
        {state.phase === "reveal" && state.album && (
          <div className="w-full animate-in fade-in duration-500">
            <RevealUI
              album={state.album}
              onRestart={handleRestart}
              dominantColor={coverColor}
            />
          </div>
        )}

        {/* Low pool indicator */}
        {state.phase === "clip" && state.needsRefill && fetchingRef.current && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <span className="text-[10px] tracking-widest uppercase opacity-20 animate-pulse">
              loading more...
            </span>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="text-center space-y-3 animate-in fade-in duration-300">
            <p className="text-sm text-red-400/80">{state.error}</p>
            <button
              onClick={handleStart}
              className="text-xs tracking-[0.2em] uppercase opacity-40 hover:opacity-60 transition-opacity"
            >
              retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
