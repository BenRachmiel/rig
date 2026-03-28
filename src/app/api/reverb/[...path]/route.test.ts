import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextRequest } from "@/test-helpers";

vi.mock("@/lib/env", () => ({
  PREAMP_ADMIN_URL: "http://preamp-admin:4534",
  PREAMP_URL: "http://preamp:4533",
}));

// Reset module between tests to clear cached API key
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadRoute() {
  return import("./route");
}

describe("Reverb proxy route", () => {
  it("auto-mints credential on first request", async () => {
    const mockFetch = vi.fn()
      // Mint call
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: "test-api-key-123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // Proxied request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "subsonic-response": { status: "ok" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/getRandomSongs?size=20");
    await GET(req, { params: Promise.resolve({ path: ["getRandomSongs"] }) });

    // Verify mint call
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const mintCall = mockFetch.mock.calls[0];
    expect(mintCall[0]).toBe("http://preamp-admin:4534/admin/credentials");
    expect(mintCall[1].method).toBe("POST");
    expect(mintCall[1].headers["remote-user"]).toBe("rig");

    const mintBody = JSON.parse(mintCall[1].body);
    expect(mintBody.client_name).toBe("rig-reverb");
    expect(mintBody.legacy_auth).toBe(false);
  });

  it("injects apiKey and f=json into proxied request", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: "key-abc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/getAlbum?id=42");
    await GET(req, { params: Promise.resolve({ path: ["getAlbum"] }) });

    const proxyCall = mockFetch.mock.calls[1];
    const proxyUrl = new URL(proxyCall[0]);
    expect(proxyUrl.origin).toBe("http://preamp:4533");
    expect(proxyUrl.pathname).toBe("/rest/getAlbum");
    expect(proxyUrl.searchParams.get("apiKey")).toBe("key-abc");
    expect(proxyUrl.searchParams.get("f")).toBe("json");
    expect(proxyUrl.searchParams.get("id")).toBe("42");
  });

  it("forwards Range headers", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: "key-range" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("audio-data", {
          status: 206,
          headers: {
            "content-type": "audio/flac",
            "content-range": "bytes 0-1023/4096",
            "accept-ranges": "bytes",
            "content-length": "1024",
          },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/stream?id=99", {
      headers: { range: "bytes=0-1023" },
    });
    const res = await GET(req, { params: Promise.resolve({ path: ["stream"] }) });

    // Verify Range was forwarded upstream
    const upstreamHeaders = mockFetch.mock.calls[1][1].headers;
    expect(upstreamHeaders.get("range")).toBe("bytes=0-1023");

    // Binary endpoints should not have f=json
    const proxyUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(proxyUrl.searchParams.has("f")).toBe(false);

    // Verify response headers forwarded back
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1023/4096");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("audio/flac");
  });

  it("returns 502 on mint failure", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response("internal error", { status: 500 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/getRandomSongs?size=10");
    const res = await GET(req, { params: Promise.resolve({ path: ["getRandomSongs"] }) });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Failed to mint");
  });
});
