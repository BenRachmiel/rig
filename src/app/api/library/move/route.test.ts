import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  MUSIC_DIR: "/music",
  PREAMP_ADMIN_URL: "http://preamp:4534",
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => null,
  }),
}));

const mockAccess = vi.fn();
const mockMkdir = vi.fn();
const mockRename = vi.fn();
const mockReaddir = vi.fn();
const mockRmdir = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    access: (...args: unknown[]) => mockAccess(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    rmdir: (...args: unknown[]) => mockRmdir(...args),
  },
}));

// Suppress fire-and-forget scan fetch
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response()));

import { POST } from "./route";

function req(body: object): Request {
  return new Request("http://localhost:3000/api/library/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/library/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves a file and returns ok", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["other.mp3"]); // parent not empty, skip rmdir

    const res = await POST(req({ from: "A/track.mp3", to: "B/track.mp3" }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRename).toHaveBeenCalledWith("/music/A/track.mp3", "/music/B/track.mp3");
  });

  it("rejects missing from/to", async () => {
    const res = await POST(req({ from: "A/track.mp3" }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects path traversal in from", async () => {
    const res = await POST(req({ from: "../etc/passwd", to: "B/file" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid path");
  });

  it("rejects path traversal in to", async () => {
    const res = await POST(req({ from: "A/file", to: "../../tmp/evil" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 500 when source does not exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockMkdir.mockResolvedValue(undefined);

    const res = await POST(req({ from: "nofile.mp3", to: "B/nofile.mp3" }) as never);
    expect(res.status).toBe(500);
  });

  it("cleans up empty parent directories after move", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    // First readdir: empty parent → rmdir, then readdir grandparent: has entries → stop
    mockReaddir.mockResolvedValueOnce([]).mockResolvedValueOnce(["other-dir"]);
    mockRmdir.mockResolvedValue(undefined);

    const res = await POST(
      req({ from: "Artist/Album/track.mp3", to: "NewArtist/Album/track.mp3" }) as never,
    );
    expect(res.status).toBe(200);
    expect(mockRmdir).toHaveBeenCalledWith("/music/Artist/Album");
  });
});
