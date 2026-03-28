"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import { reverbReducer, initialState, makeClip } from "./reducer";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useAudioReactivity } from "@/hooks/use-audio-reactivity";
import { reverbApi } from "@/lib/reverb-api";
import { ClipUI } from "@/components/reverb/clip-ui";
import { AlbumUI } from "@/components/reverb/album-ui";
import { RevealUI } from "@/components/reverb/reveal-ui";

export default function ReverbPage() {
  const [state, dispatch] = useReducer(reverbReducer, initialState);
  const fetchingRef = useRef(false);

  const engine = useAudioEngine({
    onClipEnd: () => dispatch({ type: "SKIP" }),
    onAlbumTrackChange: (index) => dispatch({ type: "TRACK_CHANGE", index }),
    onAlbumEnd: () => dispatch({ type: "REVEAL" }),
  });

  const reactivityRef = useAudioReactivity(engine.analyserNode);

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

    const nextIndex = state.poolIndex + 1;
    if (nextIndex < state.pool.length) {
      const nextClip = makeClip(state.pool[nextIndex]);
      engine.preloadClip(nextClip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentClip]);

  useEffect(() => {
    if (state.phase !== "album_loading" || !state.currentClip) return;
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
    engine.playAlbum(state.album.song, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.album]);

  useEffect(() => {
    if (state.phase !== "reveal" || !state.album) return;
    engine.stop();
    for (const song of state.album.song) {
      reverbApi.scrobble(song.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const handlePauseToggle = useCallback(() => {
    if (engine.isPlaying) engine.pause();
    else engine.resume();
  }, [engine]);

  const handleSkip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const handleBack = useCallback(() => dispatch({ type: "BACK" }), []);
  const handleCommit = useCallback(() => {
    engine.stop();
    dispatch({ type: "COMMIT" });
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

        {/* Loading */}
        {(state.phase === "loading" || state.phase === "album_loading") && (
          <div className="flex items-center gap-2 animate-in fade-in duration-300">
            <div className="size-1 rounded-full bg-white/30 animate-pulse" />
            <div className="size-1 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "150ms" }} />
            <div className="size-1 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
        )}

        {/* Clip */}
        {state.phase === "clip" && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <ClipUI
              isPlaying={engine.isPlaying}
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
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <AlbumUI
              album={state.album}
              currentTrackIndex={engine.albumTrackIndex}
              progress={engine.progress}
              isPlaying={engine.isPlaying}
              onPauseToggle={handlePauseToggle}
              onTrackSelect={(i) => engine.playAlbumTrack(i)}
              onNextTrack={() => engine.playAlbumTrack(engine.albumTrackIndex + 1)}
              onPrevTrack={() => engine.playAlbumTrack(Math.max(0, engine.albumTrackIndex - 1))}
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
            />
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
