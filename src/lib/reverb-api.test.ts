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

  describe("scrobble", () => {
    it("fires fetch and does not throw", () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      // scrobble is fire-and-forget — should not throw
      reverbApi.scrobble("song1");
      expect(mockFetch).toHaveBeenCalledWith("/api/reverb/scrobble?id=song1");
    });
  });
});
