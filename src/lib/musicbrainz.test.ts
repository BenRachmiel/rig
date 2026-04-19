import { describe, it, expect, vi, beforeEach } from "vitest";
import { escapeLucene, buildReleaseSearchUrl, fetchMusicBrainz } from "./musicbrainz";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("escapeLucene", () => {
  it("escapes all Lucene special characters", () => {
    const specials = '+-&|!(){}[]^"~*?:\\/';
    const escaped = escapeLucene(specials);
    for (const ch of specials) {
      expect(escaped).toContain(`\\${ch}`);
    }
  });

  it("returns empty string unchanged", () => {
    expect(escapeLucene("")).toBe("");
  });

  it("passes through clean string unchanged", () => {
    expect(escapeLucene("Pink Floyd")).toBe("Pink Floyd");
  });

  it("escapes mixed content", () => {
    expect(escapeLucene("AC/DC (Live)")).toBe("AC\\/DC \\(Live\\)");
  });
});

describe("buildReleaseSearchUrl", () => {
  it("builds correct URL with escaped query", () => {
    const url = buildReleaseSearchUrl("Pink Floyd", "The Wall", 5);
    expect(url).toContain("musicbrainz.org/ws/2/release");
    expect(url).toContain("fmt=json");
    expect(url).toContain("limit=5");
    expect(url).toContain(encodeURIComponent("release:The Wall AND artist:Pink Floyd"));
  });

  it("respects limit parameter", () => {
    const url = buildReleaseSearchUrl("Artist", "Album", 1);
    expect(url).toContain("limit=1");
  });

  it("escapes special characters in artist and album", () => {
    const url = buildReleaseSearchUrl("AC/DC", "Back (In) Black", 5);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("AC\\/DC");
    expect(decoded).toContain("Back \\(In\\) Black");
  });
});

describe("fetchMusicBrainz", () => {
  it("returns parsed JSON on success", async () => {
    const payload = { releases: [{ id: "abc" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      ),
    );

    const result = await fetchMusicBrainz("https://musicbrainz.org/ws/2/release?query=test");
    expect(result).toEqual(payload);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Rate limited", { status: 503 })),
    );

    await expect(
      fetchMusicBrainz("https://musicbrainz.org/ws/2/release?query=test"),
    ).rejects.toThrow("MusicBrainz returned 503");
  });

  it("sends correct headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await fetchMusicBrainz("https://example.com");
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["User-Agent"]).toContain("rig");
    expect(headers["Accept"]).toBe("application/json");
  });
});
