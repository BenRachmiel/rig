import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("searchLibrary", () => {
  it("constructs search3 URL with correct params", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": {
              status: "ok",
              searchResult3: {
                artist: [{ id: "ar1", name: "Radiohead", albumCount: 9 }],
                album: [],
                song: [],
              },
            },
          }),
      }),
    );

    const { searchLibrary } = await import("./library-api");
    const result = await searchLibrary("radiohead");

    expect(fetch).toHaveBeenCalledOnce();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/reverb/search3?");
    expect(url).toContain("query=radiohead");
    expect(url).toContain("artistCount=10");
    expect(url).toContain("albumCount=10");
    expect(url).toContain("songCount=20");
    expect(result.artists).toHaveLength(1);
    expect(result.artists[0].name).toBe("Radiohead");
  });

  it("returns empty arrays when searchResult3 is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": { status: "ok" },
          }),
      }),
    );

    const { searchLibrary } = await import("./library-api");
    const result = await searchLibrary("nonexistent");

    expect(result.artists).toHaveLength(0);
    expect(result.albums).toHaveLength(0);
    expect(result.songs).toHaveLength(0);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    const { searchLibrary } = await import("./library-api");
    await expect(searchLibrary("test")).rejects.toThrow("500");
  });

  it("encodes special characters in query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": { status: "ok", searchResult3: {} },
          }),
      }),
    );

    const { searchLibrary } = await import("./library-api");
    await searchLibrary("AC/DC & friends");

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain("AC/DC & friends");
    expect(url).toContain("query=AC");
  });
});
