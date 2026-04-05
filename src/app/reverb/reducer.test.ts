import { describe, it, expect } from "vitest";
import {
  reverbReducer,
  initialState,
  makeClip,
  CLIP_DURATION,
  type ReverbState,
} from "./reducer";
import type { SongID3, AlbumWithSongsID3 } from "@/types/api";

function fakeSong(overrides: Partial<SongID3> = {}): SongID3 {
  return {
    id: "s1",
    title: "Test Song",
    album: "Test Album",
    artist: "Test Artist",
    albumId: "a1",
    artistId: "ar1",
    track: 1,
    disc: 1,
    year: 2020,
    genre: "Rock",
    duration: 240,
    size: 10000000,
    suffix: "flac",
    bitRate: 320,
    contentType: "audio/flac",
    coverArt: "cov1",
    ...overrides,
  };
}

function fakeAlbum(overrides: Partial<AlbumWithSongsID3> = {}): AlbumWithSongsID3 {
  return {
    id: "a1",
    name: "Test Album",
    artist: "Test Artist",
    artistId: "ar1",
    coverArt: "cov1",
    songCount: 10,
    duration: 2400,
    year: 2020,
    genre: "Rock",
    created: "2020-01-01T00:00:00Z",
    song: [fakeSong({ id: "s1", track: 1 }), fakeSong({ id: "s2", track: 2 })],
    ...overrides,
  };
}

describe("makeClip", () => {
  it("returns full song when shorter than clip duration", () => {
    const song = fakeSong({ duration: 25 });
    const clip = makeClip(song);
    expect(clip.seekOffset).toBe(0);
    expect(clip.duration).toBe(25);
  });

  it("generates offset within middle 50% for long songs", () => {
    const song = fakeSong({ duration: 240 });
    for (let i = 0; i < 50; i++) {
      const clip = makeClip(song);
      const margin = song.duration * 0.25; // 60
      const maxStart = song.duration * 0.75 - CLIP_DURATION; // 150
      expect(clip.seekOffset).toBeGreaterThanOrEqual(0);
      expect(clip.seekOffset).toBeLessThanOrEqual(maxStart);
      expect(clip.seekOffset + clip.duration).toBeLessThanOrEqual(song.duration);
      expect(clip.duration).toBe(CLIP_DURATION);
    }
  });
});

describe("reverbReducer", () => {
  describe("POOL_LOADED", () => {
    it("transitions from idle to clip with first song", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" })];
      const next = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      expect(next.phase).toBe("clip");
      expect(next.pool).toHaveLength(2);
      expect(next.currentClip?.song.id).toBe("s1");
    });

    it("sets error when pool is empty", () => {
      const next = reverbReducer(initialState, { type: "POOL_LOADED", songs: [] });
      expect(next.phase).toBe("idle");
      expect(next.error).toBeTruthy();
    });
  });

  describe("SKIP", () => {
    it("advances to next clip and saves previous", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" }), fakeSong({ id: "s3" })];
      let state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      const firstClip = state.currentClip;

      state = reverbReducer(state, { type: "SKIP" });
      expect(state.currentClip?.song.id).toBe("s2");
      expect(state.previousClip).toBe(firstClip);
      expect(state.poolIndex).toBe(1);
    });

    it("sets needsRefill near pool end", () => {
      const songs = Array.from({ length: 5 }, (_, i) => fakeSong({ id: `s${i}` }));
      let state = reverbReducer(initialState, { type: "POOL_LOADED", songs });

      // Skip to near end
      state = reverbReducer(state, { type: "SKIP" });
      state = reverbReducer(state, { type: "SKIP" });
      expect(state.needsRefill).toBe(true);
    });

    it("sets needsRefill when at last song", () => {
      const songs = [fakeSong({ id: "s1" })];
      const state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      const next = reverbReducer(state, { type: "SKIP" });
      expect(next.needsRefill).toBe(true);
    });

    it("is no-op when not in clip phase", () => {
      const state = { ...initialState, phase: "idle" as const };
      expect(reverbReducer(state, { type: "SKIP" })).toBe(state);
    });
  });

  describe("BACK", () => {
    it("restores previous clip", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" })];
      let state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      state = reverbReducer(state, { type: "SKIP" });
      expect(state.currentClip?.song.id).toBe("s2");

      state = reverbReducer(state, { type: "BACK" });
      expect(state.currentClip?.song.id).toBe("s1");
      expect(state.previousClip).toBeNull();
    });

    it("is no-op when no previous clip", () => {
      const songs = [fakeSong({ id: "s1" })];
      const state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      const next = reverbReducer(state, { type: "BACK" });
      expect(next.currentClip?.song.id).toBe("s1");
    });
  });

  describe("COMMIT", () => {
    it("transitions to album_loading", () => {
      const songs = [fakeSong()];
      const state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      const next = reverbReducer(state, { type: "COMMIT" });
      expect(next.phase).toBe("album_loading");
    });
  });

  describe("ALBUM_LOADED", () => {
    it("transitions to album phase with data", () => {
      const album = fakeAlbum();
      const state: ReverbState = {
        ...initialState,
        phase: "album_loading",
        currentClip: makeClip(fakeSong()),
      };
      const next = reverbReducer(state, { type: "ALBUM_LOADED", album });
      expect(next.phase).toBe("album");
      expect(next.album).toBe(album);
      expect(next.albumTrackIndex).toBe(0);
    });
  });

  describe("TRACK_CHANGE", () => {
    it("updates track index in album phase", () => {
      const state: ReverbState = {
        ...initialState,
        phase: "album",
        album: fakeAlbum(),
      };
      const next = reverbReducer(state, { type: "TRACK_CHANGE", index: 3 });
      expect(next.albumTrackIndex).toBe(3);
    });

    it("is no-op outside album phase", () => {
      const state = { ...initialState, phase: "clip" as const };
      expect(reverbReducer(state, { type: "TRACK_CHANGE", index: 1 })).toBe(state);
    });
  });

  describe("ALBUM_FINISHED", () => {
    it("returns to clip mode when pool has songs", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" })];
      let state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      state = reverbReducer(state, { type: "COMMIT" });
      state = reverbReducer(state, { type: "ALBUM_LOADED", album: fakeAlbum() });
      expect(state.phase).toBe("album");

      const next = reverbReducer(state, { type: "ALBUM_FINISHED" });
      expect(next.phase).toBe("clip");
      expect(next.currentClip).toBeTruthy();
      expect(next.album).toBeNull();
    });

    it("restarts when pool is empty", () => {
      const state: ReverbState = {
        ...initialState,
        phase: "album",
        album: fakeAlbum(),
        pool: [],
        poolIndex: 0,
      };
      const next = reverbReducer(state, { type: "ALBUM_FINISHED" });
      expect(next.phase).toBe("loading");
    });

    it("is no-op outside album phase", () => {
      const state = { ...initialState, phase: "clip" as const };
      expect(reverbReducer(state, { type: "ALBUM_FINISHED" })).toBe(state);
    });
  });

  describe("RESTART", () => {
    it("resets to loading state", () => {
      const state: ReverbState = {
        ...initialState,
        phase: "album",
        album: fakeAlbum(),
        pool: [fakeSong()],
      };
      const next = reverbReducer(state, { type: "RESTART" });
      expect(next.phase).toBe("loading");
      expect(next.pool).toHaveLength(0);
      expect(next.album).toBeNull();
    });
  });

  describe("ABANDON_ALBUM", () => {
    it("returns to clip mode when pool has songs", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" })];
      let state = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      state = reverbReducer(state, { type: "COMMIT" });
      state = reverbReducer(state, { type: "ALBUM_LOADED", album: fakeAlbum() });
      expect(state.phase).toBe("album");

      const next = reverbReducer(state, { type: "ABANDON_ALBUM" });
      expect(next.phase).toBe("clip");
      expect(next.currentClip).toBeTruthy();
      expect(next.album).toBeNull();
    });

    it("restarts when pool is empty", () => {
      const state: ReverbState = {
        ...initialState,
        phase: "album",
        album: fakeAlbum(),
        pool: [],
        poolIndex: 0,
      };
      const next = reverbReducer(state, { type: "ABANDON_ALBUM" });
      expect(next.phase).toBe("loading");
    });

    it("is no-op outside album phase", () => {
      const state = { ...initialState, phase: "clip" as const };
      expect(reverbReducer(state, { type: "ABANDON_ALBUM" })).toBe(state);
    });
  });

  describe("DIRECT_ALBUM_LOADING", () => {
    it("sets phase to album_loading", () => {
      const next = reverbReducer(initialState, { type: "DIRECT_ALBUM_LOADING" });
      expect(next.phase).toBe("album_loading");
    });

    it("sets phase to album_loading from any phase", () => {
      const songs = [fakeSong()];
      const clipState = reverbReducer(initialState, { type: "POOL_LOADED", songs });
      expect(clipState.phase).toBe("clip");

      const next = reverbReducer(clipState, { type: "DIRECT_ALBUM_LOADING" });
      expect(next.phase).toBe("album_loading");
    });
  });

  describe("POOL_LOADED guards", () => {
    it("is no-op when phase is album_loading", () => {
      const state: ReverbState = { ...initialState, phase: "album_loading" };
      const songs = [fakeSong()];
      const next = reverbReducer(state, { type: "POOL_LOADED", songs });
      expect(next).toBe(state);
    });

    it("is no-op when phase is album", () => {
      const state: ReverbState = { ...initialState, phase: "album", album: fakeAlbum() };
      const songs = [fakeSong()];
      const next = reverbReducer(state, { type: "POOL_LOADED", songs });
      expect(next).toBe(state);
    });

  });

  describe("DIRECT_ALBUM", () => {
    it("transitions directly to album phase from idle", () => {
      const album = fakeAlbum();
      const next = reverbReducer(initialState, { type: "DIRECT_ALBUM", album });
      expect(next.phase).toBe("album");
      expect(next.album).toBe(album);
      expect(next.albumTrackIndex).toBe(0);
    });

    it("transitions from album_loading to album", () => {
      const state: ReverbState = { ...initialState, phase: "album_loading" };
      const album = fakeAlbum();
      const next = reverbReducer(state, { type: "DIRECT_ALBUM", album });
      expect(next.phase).toBe("album");
      expect(next.album).toBe(album);
    });

    it("resets pool state on direct album load", () => {
      const songs = [fakeSong({ id: "s1" }), fakeSong({ id: "s2" })];
      const clipState = reverbReducer(initialState, { type: "POOL_LOADED", songs });

      const album = fakeAlbum();
      const next = reverbReducer(clipState, { type: "DIRECT_ALBUM", album });
      expect(next.phase).toBe("album");
      expect(next.pool).toHaveLength(0);
      expect(next.currentClip).toBeNull();
    });
  });

  describe("ERROR", () => {
    it("sets error message", () => {
      const next = reverbReducer(initialState, {
        type: "ERROR",
        message: "Network failed",
      });
      expect(next.error).toBe("Network failed");
    });
  });
});
