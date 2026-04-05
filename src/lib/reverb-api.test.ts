import { describe, it, expect, vi, beforeEach } from "vitest";
import { reverbApi } from "./reverb-api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("reverbApi", () => {
  describe("getRandomSongs", () => {
    it("parses nested Subsonic response and filters short songs", async () => {
      const songs = [
        { id: "1", title: "Long", duration: 200 },
        { id: "2", title: "Short", duration: 30 },
        { id: "3", title: "Medium", duration: 46 },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": {
                status: "ok",
                randomSongs: { song: songs },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getRandomSongs(20);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("3");
    });

    it("returns empty array when no songs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": {
                status: "ok",
                randomSongs: { song: undefined },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getRandomSongs();
      expect(result).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })),
      );

      await expect(reverbApi.getRandomSongs()).rejects.toThrow("500");
    });
  });

  describe("getAlbum", () => {
    it("parses album response", async () => {
      const album = { id: "a1", name: "Test Album", artist: "Test Artist", song: [] };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": { status: "ok", album },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getAlbum("a1");
      expect(result.name).toBe("Test Album");
    });
  });

  describe("URL builders", () => {
    it("streamUrl returns correct path", () => {
      expect(reverbApi.streamUrl("123")).toBe("/api/reverb/stream?id=123");
    });

    it("streamUrl encodes special characters", () => {
      expect(reverbApi.streamUrl("a b&c")).toBe("/api/reverb/stream?id=a%20b%26c");
    });

    it("coverArtUrl returns correct path with default size", () => {
      expect(reverbApi.coverArtUrl("art1")).toBe("/api/reverb/getCoverArt?id=art1&size=256");
    });

    it("coverArtUrl accepts custom size", () => {
      expect(reverbApi.coverArtUrl("art1", 512)).toBe("/api/reverb/getCoverArt?id=art1&size=512");
    });
  });

  describe("getLyrics", () => {
    it("returns structured lyrics for a song", async () => {
      const lyrics = [
        { lang: "eng", synced: true, line: [{ start: 0, value: "Hello" }] },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": {
                status: "ok",
                lyricsList: { structuredLyrics: lyrics },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getLyrics("song-1");
      expect(result).toEqual(lyrics);
    });

    it("returns empty array when no lyrics", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": { status: "ok", lyricsList: {} },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getLyrics("song-1");
      expect(result).toEqual([]);
    });
  });

  describe("star/unstar", () => {
    it("calls star endpoint", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await reverbApi.star("song-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/star?id=song-1"),
      );
    });

    it("calls unstar endpoint", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await reverbApi.unstar("song-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/unstar?id=song-1"),
      );
    });
  });

  describe("setRating", () => {
    it("calls setRating with song ID and rating", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await reverbApi.setRating("song-1", 4);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/setRating?id=song-1&rating=4"),
      );
    });
  });

  describe("getStarred", () => {
    it("returns starred songs", async () => {
      const songs = [{ id: "s1", title: "Song 1" }];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": { status: "ok", starred2: { song: songs } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getStarred();
      expect(result).toEqual(songs);
    });

    it("returns empty array when nothing starred", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": { status: "ok", starred2: {} },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.getStarred();
      expect(result).toEqual([]);
    });
  });

  describe("searchAlbum", () => {
    it("finds album by artist and name match", async () => {
      const album = { id: "a1", name: "Album", artist: "Artist" };
      const fullAlbum = { ...album, song: [], songCount: 0 };
      const searchFetch = vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              "subsonic-response": {
                status: "ok",
                searchResult3: { album: [album] },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              "subsonic-response": { status: "ok", album: fullAlbum },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      vi.stubGlobal("fetch", searchFetch);

      const result = await reverbApi.searchAlbum("Artist", "Album");
      expect(result).toEqual(fullAlbum);
    });

    it("returns null when no results", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              "subsonic-response": {
                status: "ok",
                searchResult3: { album: [] },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      const result = await reverbApi.searchAlbum("Artist", "Album");
      expect(result).toBeNull();
    });
  });
});
