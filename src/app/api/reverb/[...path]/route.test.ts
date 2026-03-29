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

/** Returns a Response with an empty JSON array (no existing credentials). */
function emptyCredsResponse() {
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Reverb proxy route", () => {
  it("auto-mints credential on first request", async () => {
    const mockFetch = vi.fn()
      // Cleanup list
      .mockResolvedValueOnce(emptyCredsResponse())
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

    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify cleanup list call
    const listCall = mockFetch.mock.calls[0];
    expect(listCall[0]).toBe("http://preamp-admin:4534/admin/credentials");
    expect(listCall[1].headers["remote-user"]).toBe("rig");

    // Verify mint call
    const mintCall = mockFetch.mock.calls[1];
    expect(mintCall[0]).toBe("http://preamp-admin:4534/admin/credentials");
    expect(mintCall[1].method).toBe("POST");
    expect(mintCall[1].headers["remote-user"]).toBe("rig");

    const mintBody = JSON.parse(mintCall[1].body);
    expect(mintBody.client_name).toBe("rig-reverb");
    expect(mintBody.legacy_auth).toBe(false);
  });

  it("injects apiKey and f=json into proxied request", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(emptyCredsResponse())
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

    const proxyCall = mockFetch.mock.calls[2];
    const proxyUrl = new URL(proxyCall[0]);
    expect(proxyUrl.origin).toBe("http://preamp:4533");
    expect(proxyUrl.pathname).toBe("/rest/getAlbum");
    expect(proxyUrl.searchParams.get("apiKey")).toBe("key-abc");
    expect(proxyUrl.searchParams.get("f")).toBe("json");
    expect(proxyUrl.searchParams.get("id")).toBe("42");
  });

  it("forwards Range headers", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(emptyCredsResponse())
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
    const upstreamHeaders = mockFetch.mock.calls[2][1].headers;
    expect(upstreamHeaders.get("range")).toBe("bytes=0-1023");

    // Binary endpoints should not have f=json
    const proxyUrl = new URL(mockFetch.mock.calls[2][0]);
    expect(proxyUrl.searchParams.has("f")).toBe(false);

    // Verify response headers forwarded back
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1023/4096");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("audio/flac");
  });

  it("returns 502 on mint failure", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(emptyCredsResponse())
      .mockResolvedValueOnce(
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

  it("cleans up stale rig-reverb credentials before minting", async () => {
    const mockFetch = vi.fn()
      // Cleanup list — 2 rig-reverb + 1 other
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "cred-1", client_name: "rig-reverb" },
            { id: "cred-2", client_name: "rig-reverb" },
            { id: "cred-3", client_name: "other-client" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      // DELETE cred-1
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      // DELETE cred-2
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      // Mint
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: "fresh-key" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      // Proxy
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/ping");
    await GET(req, { params: Promise.resolve({ path: ["ping"] }) });

    // List call
    expect(mockFetch.mock.calls[0][0]).toBe("http://preamp-admin:4534/admin/credentials");

    // Only rig-reverb credentials deleted (cred-1, cred-2), not cred-3
    const deleteCalls = mockFetch.mock.calls.filter(
      ([, opts]) => opts?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls[0][0]).toBe("http://preamp-admin:4534/admin/credentials/cred-1");
    expect(deleteCalls[1][0]).toBe("http://preamp-admin:4534/admin/credentials/cred-2");
  });

  it("proceeds with mint even if cleanup fails", async () => {
    const mockFetch = vi.fn()
      // Cleanup list returns 500
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      // Mint still proceeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: "key-despite-failure" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      // Proxy
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { GET } = await loadRoute();
    const req = nextRequest("http://localhost/api/reverb/ping");
    const res = await GET(req, { params: Promise.resolve({ path: ["ping"] }) });

    expect(res.status).toBe(200);
    // Mint still happened despite cleanup failure
    const mintCall = mockFetch.mock.calls[1];
    expect(mintCall[0]).toBe("http://preamp-admin:4534/admin/credentials");
    expect(mintCall[1].method).toBe("POST");
  });
});
