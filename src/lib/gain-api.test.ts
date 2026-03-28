import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchAlbums, resolveStreamUrl } from "./gain-api";
import type { Album } from "@/types/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("searchAlbums", () => {
  it("passes source param in URL", async () => {
    const albums: Album[] = [
      {
        id: "123",
        title: "Test",
        artist: "Artist",
        cover: "",
        tracks: 10,
        year: "2024",
        source: "tidal",
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ albums }),
    });

    await searchAlbums("test query", "tidal");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("source=tidal"),
      undefined
    );
  });

  it("passes youtube source param", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ albums: [] }),
    });

    await searchAlbums("test", "youtube");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("source=youtube"),
      undefined
    );
  });

  it("defaults to tidal source", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ albums: [] }),
    });

    await searchAlbums("test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("source=tidal"),
      undefined
    );
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: "Search failed" }),
    });

    await expect(searchAlbums("test")).rejects.toThrow("Search failed");
  });
});

describe("resolveStreamUrl", () => {
  it("includes source param for tidal", () => {
    const url = resolveStreamUrl("12345", "tidal");
    expect(url).toBe("/api/gain/resolve/12345?source=tidal");
  });

  it("includes source param for youtube", () => {
    const url = resolveStreamUrl("yt:dQw4w9WgXcQ", "youtube");
    expect(url).toBe(
      "/api/gain/resolve/yt%3AdQw4w9WgXcQ?source=youtube"
    );
  });

  it("defaults to tidal", () => {
    const url = resolveStreamUrl("12345");
    expect(url).toBe("/api/gain/resolve/12345?source=tidal");
  });

  it("encodes album ID with special chars", () => {
    const url = resolveStreamUrl("ytpl:PLrAXtm+test", "youtube");
    expect(url).toContain("ytpl%3APLrAXtm%2Btest");
  });
});
