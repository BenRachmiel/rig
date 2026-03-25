import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextRequest } from "@/test-helpers";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { GET } from "./route";

const BASE = "http://localhost/api/library/musicbrainz";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockMbResponse(releases: unknown[] = []) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ releases }),
  });
}

function req(params: Record<string, string>) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return nextRequest(url.toString());
}

describe("GET /api/library/musicbrainz", () => {
  it("returns 400 when artist or album is missing", async () => {
    const res = await GET(nextRequest(BASE));
    expect(res.status).toBe(400);
  });

  it("escapes parentheses in album name", async () => {
    mockMbResponse();
    await GET(req({ artist: "Bjork", album: "Debut (Deluxe Edition)" }));
    const url = mockFetch.mock.calls[0][0] as string;
    const query = decodeURIComponent(url.split("query=")[1].split("&")[0]);
    expect(query).toContain("\\(Deluxe Edition\\)");
  });

  it("escapes slashes in artist name", async () => {
    mockMbResponse();
    await GET(req({ artist: "AC/DC", album: "Highway to Hell" }));
    const url = mockFetch.mock.calls[0][0] as string;
    const query = decodeURIComponent(url.split("query=")[1].split("&")[0]);
    expect(query).toContain("AC\\/DC");
  });

  it("escapes quotes in names", async () => {
    mockMbResponse();
    await GET(req({ artist: 'The "Great" Band', album: "Test" }));
    const url = mockFetch.mock.calls[0][0] as string;
    const query = decodeURIComponent(url.split("query=")[1].split("&")[0]);
    expect(query).toContain('\\"Great\\"');
  });

  it("escapes colons in album name", async () => {
    mockMbResponse();
    await GET(req({ artist: "Artist", album: "Vol. 1: The Beginning" }));
    const url = mockFetch.mock.calls[0][0] as string;
    const query = decodeURIComponent(url.split("query=")[1].split("&")[0]);
    expect(query).toContain("Vol. 1\\: The Beginning");
  });

  it("passes clean names through unchanged", async () => {
    mockMbResponse();
    await GET(req({ artist: "Radiohead", album: "OK Computer" }));
    const url = mockFetch.mock.calls[0][0] as string;
    const query = decodeURIComponent(url.split("query=")[1].split("&")[0]);
    expect(query).toBe("release:OK Computer AND artist:Radiohead");
  });

  it("returns results from MusicBrainz", async () => {
    mockMbResponse([
      {
        id: "abc-123",
        title: "OK Computer",
        "artist-credit": [{ name: "Radiohead" }],
        date: "1997-06-16",
        tags: [{ name: "alternative rock", count: 5 }],
      },
    ]);
    const res = await GET(req({ artist: "Radiohead", album: "OK Computer" }));
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe("OK Computer");
    expect(data.results[0].year).toBe("1997");
  });

  it("returns 502 when MusicBrainz fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const res = await GET(req({ artist: "A", album: "B" }));
    expect(res.status).toBe(502);
  });
});
