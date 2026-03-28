"use client";

import { createContext, useContext, useRef, useCallback, useEffect, useMemo } from "react";
import { useAudioEngine, type AudioEngineCallbacks } from "@/hooks/use-audio-engine";
import { usePlaybackStore } from "@/stores/playback-store";
import type { Clip } from "@/app/reverb/reducer";
import type { SongID3 } from "@/types/api";

const noopCallbacks: AudioEngineCallbacks = {
  onClipEnd: () => {},
  onAlbumTrackChange: () => {},
  onAlbumEnd: () => {},
};

export interface PlaybackContextValue {
  playClip: (clip: Clip) => Promise<void>;
  preloadClip: (clip: Clip) => void;
  playAlbum: (songs: SongID3[], startIndex: number) => Promise<void>;
  playAlbumTrack: (index: number) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isBuffering: boolean;
  loadError: string | null;
  progress: number;
  albumTrackIndex: number;
  analyserNode: AnalyserNode | null;
  setCallbacks: (cb: AudioEngineCallbacks) => void;
  clearCallbacks: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

/** Throttle progress sync to ~4fps instead of ~15fps */
const PROGRESS_SYNC_INTERVAL = 250;

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const callbacksRef = useRef<AudioEngineCallbacks>(noopCallbacks);

  const engine = useAudioEngine({
    onClipEnd: () => callbacksRef.current.onClipEnd(),
    onAlbumTrackChange: (i) => callbacksRef.current.onAlbumTrackChange(i),
    onAlbumEnd: () => callbacksRef.current.onAlbumEnd(),
  });

  const setCallbacks = useCallback((cb: AudioEngineCallbacks) => {
    callbacksRef.current = cb;
  }, []);

  const clearCallbacks = useCallback(() => {
    callbacksRef.current = noopCallbacks;
  }, []);

  // Register control methods in the Zustand store so mini-player can call them without context
  useEffect(() => {
    usePlaybackStore.getState().setControls({
      pause: engine.pause,
      resume: engine.resume,
      stop: engine.stop,
    });
  }, [engine.pause, engine.resume, engine.stop]);

  // Sync state to Zustand (cheap, infrequent changes)
  useEffect(() => { usePlaybackStore.getState().setIsPlaying(engine.isPlaying); }, [engine.isPlaying]);
  useEffect(() => { usePlaybackStore.getState().setIsBuffering(engine.isBuffering); }, [engine.isBuffering]);
  useEffect(() => { usePlaybackStore.getState().setAnalyserNode(engine.analyserNode); }, [engine.analyserNode]);

  // Throttle progress sync — mini-player progress bar uses CSS transition anyway
  const lastSyncRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastSyncRef.current < PROGRESS_SYNC_INTERVAL) return;
    lastSyncRef.current = now;
    usePlaybackStore.getState().setProgress(engine.progress);
  }, [engine.progress]);

  // Memoize stable methods (identity doesn't change between renders)
  const methods = useMemo(() => ({
    playClip: engine.playClip,
    preloadClip: engine.preloadClip,
    playAlbum: engine.playAlbum,
    playAlbumTrack: engine.playAlbumTrack,
    pause: engine.pause,
    resume: engine.resume,
    stop: engine.stop,
    setCallbacks,
    clearCallbacks,
  }), [engine.playClip, engine.preloadClip, engine.playAlbum, engine.playAlbumTrack,
       engine.pause, engine.resume, engine.stop, setCallbacks, clearCallbacks]);

  // Combine stable methods with volatile state — useMemo prevents re-creation when methods haven't changed
  const value = useMemo<PlaybackContextValue>(() => ({
    ...methods,
    isPlaying: engine.isPlaying,
    isBuffering: engine.isBuffering,
    loadError: engine.loadError,
    progress: engine.progress,
    albumTrackIndex: engine.albumTrackIndex,
    analyserNode: engine.analyserNode,
  }), [methods, engine.isPlaying, engine.isBuffering, engine.loadError,
       engine.progress, engine.albumTrackIndex, engine.analyserNode]);

  return (
    <PlaybackContext value={value}>
      {children}
    </PlaybackContext>
  );
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
