import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextRequest } from "@/test-helpers";

vi.mock("@/lib/env", () => ({
  MUSIC_DIR: "/music",
  PREAMP_ADMIN_URL: "http://preamp:4534",
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => null,
  }),
}));

const mockParseFile = vi.fn();
vi.mock("music-metadata", () => ({
  parseFile: (...args: unknown[]) => mockParseFile(...args),
}));

const mockCreate = vi.fn();
vi.mock("node-id3", () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

// Mock fs operations for PATCH streaming writes
const mockOpen = vi.fn();
const mockRename = vi.fn();
const mockUnlink = vi.fn();
const mockStat = vi.fn();
const mockChmod = vi.fn();
vi.mock("node:fs/promises", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  chmod: (...args: unknown[]) => mockChmod(...args),
}));

// Mock createReadStream / createWriteStream
const mockWriteStream = {
  write: vi.fn((_data: unknown, cb: (err?: Error | null) => void) => cb(null)),
};
const mockReadStream = {};
const mockCreateWriteStream = vi.fn(() => mockWriteStream);
vi.mock("node:fs", () => ({
  createReadStream: () => mockReadStream,
  createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
}));

vi.mock("node:stream/promises", () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response()));

import { GET, PATCH } from "./route";

function getReq(file: string) {
  return nextRequest(
    `http://localhost:3000/api/library/tags?file=${encodeURIComponent(file)}`,
  );
}

function patchReq(body: object) {
  return nextRequest("http://localhost:3000/api/library/tags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/library/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tag data for a valid file", async () => {
    mockParseFile.mockResolvedValue({
      common: {
        title: "Song",
        artist: "Artist",
        album: "Album",
        albumartist: "Album Artist",
        genre: ["Rock"],
        year: 2020,
        track: { no: 3, of: 12 },
        disk: { no: 1 },
        picture: [{ data: Buffer.from("img") }],
      },
      format: {
        duration: 245.7,
        bitrate: 320000,
      },
    });

    const res = await GET(getReq("Artist/Album/track.mp3") as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      title: "Song",
      artist: "Artist",
      album: "Album",
      albumArtist: "Album Artist",
      genre: "Rock",
      year: 2020,
      track: 3,
      trackTotal: 12,
      disc: 1,
      duration: 246,
      bitrate: 320,
      hasCover: true,
    });
  });

  it("returns nulls for missing metadata", async () => {
    mockParseFile.mockResolvedValue({
      common: {},
      format: {},
    });

    const res = await GET(getReq("track.mp3") as never);
    const body = await res.json();

    expect(body.title).toBeNull();
    expect(body.artist).toBeNull();
    expect(body.hasCover).toBe(false);
    expect(body.duration).toBeNull();
  });

  it("returns 400 when file param is missing", async () => {
    const res = await GET(nextRequest("http://localhost:3000/api/library/tags") as never);
    expect(res.status).toBe(400);
  });

  it("rejects path traversal", async () => {
    const res = await GET(getReq("../../etc/passwd") as never);
    expect(res.status).toBe(400);
  });

  it("returns 500 on parse failure", async () => {
    mockParseFile.mockRejectedValue(new Error("corrupt file"));

    const res = await GET(getReq("bad.mp3") as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("corrupt file");
  });
});

describe("PATCH /api/library/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file has an ID3v2 header (10-byte header + 100 bytes tag body)
    const headerBuf = Buffer.alloc(10);
    headerBuf[0] = 0x49; // 'I'
    headerBuf[1] = 0x44; // 'D'
    headerBuf[2] = 0x33; // '3'
    headerBuf[3] = 3; // version
    headerBuf[4] = 0; // revision
    headerBuf[5] = 0; // flags
    // syncsafe encode 100: 0x00 0x00 0x00 0x64
    headerBuf[6] = 0;
    headerBuf[7] = 0;
    headerBuf[8] = 0;
    headerBuf[9] = 100;
    mockOpen.mockResolvedValue({
      read: vi.fn().mockResolvedValue({ bytesRead: 10, buffer: headerBuf }),
      close: vi.fn().mockResolvedValue(undefined),
    });
    mockStat.mockResolvedValue({ mode: 0o100644 });
    mockRename.mockResolvedValue(undefined);
    mockChmod.mockResolvedValue(undefined);
  });

  it("writes tags via streaming and returns ok", async () => {
    mockParseFile.mockResolvedValue({
      common: { title: "Old Title" },
      format: {},
    });
    mockCreate.mockReturnValue(Buffer.from("ID3TAG"));

    const res = await PATCH(
      patchReq({ file: "track.mp3", tags: { title: "New Title", year: 2024 } }) as never,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Title", year: "2024" }),
    );
    // Should write the tag buffer to the write stream
    expect(mockWriteStream.write).toHaveBeenCalled();
    // Should rename temp file over original
    expect(mockRename).toHaveBeenCalled();
  });

  it("returns 400 when file or tags is missing", async () => {
    const res = await PATCH(patchReq({ file: "track.mp3" }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects path traversal", async () => {
    const res = await PATCH(
      patchReq({ file: "../secret", tags: { title: "x" } }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when create fails", async () => {
    mockParseFile.mockResolvedValue({ common: {}, format: {} });
    mockCreate.mockReturnValue("not a buffer");

    const res = await PATCH(
      patchReq({ file: "track.mp3", tags: { title: "x" } }) as never,
    );
    expect(res.status).toBe(500);
  });

  it("writes temp file in the same directory as the source file", async () => {
    mockParseFile.mockResolvedValue({
      common: { title: "Old" },
      format: {},
    });
    mockCreate.mockReturnValue(Buffer.from("ID3TAG"));

    await PATCH(
      patchReq({ file: "Artist/Album/track.mp3", tags: { artist: "New Artist" } }) as never,
    );

    // The temp file path should be in /music/Artist/Album/, not /tmp/
    const tmpPath = mockCreateWriteStream.mock.calls[0][0] as string;
    expect(tmpPath).toMatch(/^\/music\/Artist\/Album\/\.rig-tag-/);
    expect(tmpPath).not.toContain("/tmp/");
  });

  it("orders text fields before binary fields", async () => {
    mockParseFile.mockResolvedValue({
      common: {
        title: "Old",
        picture: [{ format: "image/jpeg", type: 3, description: "", data: Buffer.from("img") }],
      },
      format: {},
    });
    mockCreate.mockReturnValue(Buffer.from("ID3TAG"));

    await PATCH(patchReq({ file: "track.mp3", tags: { title: "New" } }) as never);

    const writtenTags = mockCreate.mock.calls[0][0];
    const keys = Object.keys(writtenTags);
    const titleIdx = keys.indexOf("title");
    const imageIdx = keys.indexOf("image");
    expect(titleIdx).toBeLessThan(imageIdx);
  });
});
