import type { SongID3, AlbumWithSongsID3 } from "@/types/api";

export interface Clip {
  song: SongID3;
  seekOffset: number;
  duration: number;
}

export type Phase = "idle" | "loading" | "clip" | "album_loading" | "album" | "reveal";

export interface ReverbState {
  phase: Phase;
  pool: SongID3[];
  poolIndex: number;
  currentClip: Clip | null;
  previousClip: Clip | null;
  album: AlbumWithSongsID3 | null;
  albumTrackIndex: number;
  needsRefill: boolean;
  error: string | null;
}

export type ReverbAction =
  | { type: "POOL_LOADED"; songs: SongID3[] }
  | { type: "SKIP" }
  | { type: "BACK" }
  | { type: "COMMIT" }
  | { type: "ALBUM_LOADED"; album: AlbumWithSongsID3 }
  | { type: "TRACK_CHANGE"; index: number }
  | { type: "REVEAL" }
  | { type: "RESTART" }
  | { type: "RESTORE"; album: AlbumWithSongsID3; trackIndex: number }
  | { type: "ABANDON_ALBUM" }
  | { type: "DIRECT_ALBUM_LOADING" }
  | { type: "DIRECT_ALBUM"; album: AlbumWithSongsID3 }
  | { type: "ERROR"; message: string };

export const CLIP_DURATION = 30;

export function makeClip(song: SongID3, clipDuration = CLIP_DURATION): Clip {
  if (song.duration <= clipDuration) {
    return { song, seekOffset: 0, duration: song.duration };
  }

  const margin = song.duration * 0.25;
  const maxStart = song.duration * 0.75 - clipDuration;
  const seekOffset = Math.max(0, margin + Math.random() * (maxStart - margin));

  return { song, seekOffset, duration: clipDuration };
}

export const initialState: ReverbState = {
  phase: "idle",
  pool: [],
  poolIndex: 0,
  currentClip: null,
  previousClip: null,
  album: null,
  albumTrackIndex: 0,
  needsRefill: false,
  error: null,
};

const REFILL_THRESHOLD = 5;

export function reverbReducer(state: ReverbState, action: ReverbAction): ReverbState {
  switch (action.type) {
    case "POOL_LOADED": {
      // Don't overwrite album/album_loading phases with clip view
      if (state.phase === "album" || state.phase === "album_loading" || state.phase === "reveal") {
        return state;
      }
      const pool = [...state.pool, ...action.songs];
      if (pool.length === 0) {
        return { ...state, phase: "idle", error: "No songs found in library" };
      }
      // Only create a clip if we don't already have one (first load).
      // Refills just extend the pool — the current clip stays as-is.
      if (state.currentClip) {
        return { ...state, pool, needsRefill: false, error: null };
      }
      const clip = makeClip(pool[state.poolIndex]);
      return {
        ...state,
        phase: "clip",
        pool,
        currentClip: clip,
        needsRefill: false,
        error: null,
      };
    }

    case "SKIP": {
      if (state.phase !== "clip" || !state.currentClip) return state;
      const nextIndex = state.poolIndex + 1;
      if (nextIndex >= state.pool.length) {
        return { ...state, needsRefill: true };
      }
      const clip = makeClip(state.pool[nextIndex]);
      return {
        ...state,
        poolIndex: nextIndex,
        previousClip: state.currentClip,
        currentClip: clip,
        needsRefill: state.pool.length - nextIndex <= REFILL_THRESHOLD,
      };
    }

    case "BACK": {
      if (state.phase !== "clip" || !state.previousClip) return state;
      return {
        ...state,
        poolIndex: Math.max(0, state.poolIndex - 1),
        currentClip: state.previousClip,
        previousClip: null,
      };
    }

    case "COMMIT": {
      if (state.phase !== "clip" || !state.currentClip) return state;
      return { ...state, phase: "album_loading" };
    }

    case "ALBUM_LOADED": {
      return {
        ...state,
        phase: "album",
        album: action.album,
        albumTrackIndex: 0,
      };
    }

    case "TRACK_CHANGE": {
      if (state.phase !== "album") return state;
      return { ...state, albumTrackIndex: action.index };
    }

    case "REVEAL": {
      if (state.phase !== "album") return state;
      return { ...state, phase: "reveal" };
    }

    case "RESTORE": {
      return {
        ...initialState,
        phase: "album",
        album: action.album,
        albumTrackIndex: action.trackIndex,
      };
    }

    case "ABANDON_ALBUM": {
      if (state.phase !== "album" && state.phase !== "reveal") return state;
      // Return to clip mode if we have pool songs, otherwise restart
      if (state.pool.length > 0 && state.poolIndex < state.pool.length) {
        const clip = makeClip(state.pool[state.poolIndex]);
        return {
          ...state,
          phase: "clip",
          currentClip: clip,
          album: null,
          albumTrackIndex: 0,
        };
      }
      return { ...initialState, phase: "loading" };
    }

    case "DIRECT_ALBUM_LOADING": {
      return { ...state, phase: "album_loading" };
    }

    case "DIRECT_ALBUM": {
      return {
        ...initialState,
        phase: "album",
        album: action.album,
        albumTrackIndex: 0,
      };
    }

    case "RESTART": {
      return { ...initialState, phase: "loading" };
    }

    case "ERROR": {
      return { ...state, error: action.message };
    }

    default:
      return state;
  }
}
