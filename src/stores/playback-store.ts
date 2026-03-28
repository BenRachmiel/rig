import { create } from "zustand";
import type { AlbumWithSongsID3 } from "@/types/api";

export type PlaybackMode = "clip" | "album" | "idle";

export interface PlaybackTrack {
  title: string;
  artist: string;
  album: string;
}

interface PlaybackStore {
  track: PlaybackTrack | null;
  mode: PlaybackMode;
  /** Persists the album across route changes so Reverb can restore its view */
  reverbAlbum: AlbumWithSongsID3 | null;
  isPlaying: boolean;
  progress: number;
  isBuffering: boolean;
  miniPlayerVisible: boolean;
  analyserNode: AnalyserNode | null;

  // Control callbacks — set by PlaybackProvider, called by mini-player
  controls: {
    pause: () => void;
    resume: () => Promise<void>;
    stop: () => void;
  };

  setTrack: (track: PlaybackTrack | null) => void;
  setMode: (mode: PlaybackMode) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setIsBuffering: (buffering: boolean) => void;
  showMiniPlayer: () => void;
  hideMiniPlayer: () => void;
  setControls: (controls: PlaybackStore["controls"]) => void;
  setAnalyserNode: (node: AnalyserNode | null) => void;
  setReverbAlbum: (album: AlbumWithSongsID3 | null) => void;
  /** Batch multiple state fields in one update */
  startPlayback: (track: PlaybackTrack, mode: PlaybackMode, album: AlbumWithSongsID3) => void;
  clearPlayback: () => void;
}

const noopControls = {
  pause: () => {},
  resume: async () => {},
  stop: () => {},
};

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  track: null,
  mode: "idle",
  isPlaying: false,
  progress: 0,
  isBuffering: false,
  miniPlayerVisible: false,
  reverbAlbum: null,
  analyserNode: null,
  controls: noopControls,

  setTrack: (track) => set({ track }),
  setMode: (mode) => set({ mode }),
  setIsPlaying: (playing) => {
    if (get().isPlaying === playing) return;
    set({ isPlaying: playing });
  },
  setProgress: (progress) => {
    if (get().progress === progress) return;
    set({ progress });
  },
  setIsBuffering: (buffering) => {
    if (get().isBuffering === buffering) return;
    set({ isBuffering: buffering });
  },
  showMiniPlayer: () => set({ miniPlayerVisible: true }),
  hideMiniPlayer: () => set({ miniPlayerVisible: false }),
  setControls: (controls) => set({ controls }),
  setAnalyserNode: (analyserNode) => {
    if (get().analyserNode === analyserNode) return;
    set({ analyserNode });
  },
  setReverbAlbum: (reverbAlbum) => set({ reverbAlbum }),
  startPlayback: (track, mode, album) => set({ track, mode, miniPlayerVisible: true, reverbAlbum: album }),
  clearPlayback: () => set({ track: null, miniPlayerVisible: false, mode: "idle", reverbAlbum: null }),
}));
