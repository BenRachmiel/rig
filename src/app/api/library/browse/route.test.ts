import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent, Stats } from "node:fs";
import { nextRequest } from "@/test-helpers";

// Mock env before importing route
vi.mock("@/lib/env", () => ({ MUSIC_DIR: "/music" }));

// Mock fs/promises
const mockStat = vi.fn();
const mockReaddir = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    stat: (...args: unknown[]) => mockStat(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
  },
}));

import { GET } from "./route";

function req(path: string) {
  return nextRequest(`http://localhost:3000/api/library/browse?path=${encodeURIComponent(path)}`);
}

function dirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  } as Dirent;
}

describe("GET /api/library/browse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sorted entries with directories first", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockReaddir.mockResolvedValue([
      dirent("track.mp3", false),
      dirent("Subfolder", true),
      dirent("another.flac", false),
    ]);

    const res = await GET(req("") as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toEqual([
      { name: "Subfolder", type: "directory", path: "Subfolder" },
      { name: "another.flac", type: "file", path: "another.flac" },
      { name: "track.mp3", type: "file", path: "track.mp3" },
    ]);
  });

  it("filters hidden files", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockReaddir.mockResolvedValue([
      dirent(".hidden", true),
      dirent(".DS_Store", false),
      dirent("visible.mp3", false),
    ]);

    const res = await GET(req("") as never);
    const body = await res.json();

    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].name).toBe("visible.mp3");
  });

  it("filters non-audio files", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockReaddir.mockResolvedValue([
      dirent("readme.txt", false),
      dirent("cover.jpg", false),
      dirent("track.mp3", false),
      dirent("song.flac", false),
    ]);

    const res = await GET(req("") as never);
    const body = await res.json();

    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: { name: string }) => e.name)).toEqual([
      "song.flac",
      "track.mp3",
    ]);
  });

  it("rejects directory traversal", async () => {
    const res = await GET(req("../etc") as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid path");
  });

  it("returns 400 for non-directory path", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false } as Stats);

    const res = await GET(req("track.mp3") as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Not a directory");
  });

  it("returns 404 when path does not exist", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));

    const res = await GET(req("nonexistent") as never);
    expect(res.status).toBe(404);
  });
});
