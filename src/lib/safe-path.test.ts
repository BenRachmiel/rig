import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ MUSIC_DIR: "/music" }));

import { resolveSafe, safePathSegment } from "./safe-path";

describe("resolveSafe", () => {
  it("resolves a simple relative path", () => {
    expect(resolveSafe("Artist/Album/track.mp3")).toBe(
      "/music/Artist/Album/track.mp3",
    );
  });

  it("resolves empty string to MUSIC_DIR", () => {
    expect(resolveSafe("")).toBe("/music");
  });

  it("rejects path traversal with ..", () => {
    expect(resolveSafe("../etc/passwd")).toBeNull();
  });

  it("rejects deeply nested traversal", () => {
    expect(resolveSafe("Artist/../../etc/shadow")).toBeNull();
  });

  it("rejects absolute paths outside MUSIC_DIR", () => {
    expect(resolveSafe("/etc/passwd")).toBeNull();
  });

  it("allows absolute path within MUSIC_DIR", () => {
    // path.resolve("/music", "/music/foo") → "/music/foo"
    // but path.resolve("/music", "/tmp") → "/tmp"
    expect(resolveSafe("/tmp/evil")).toBeNull();
  });

  it("normalises double slashes", () => {
    expect(resolveSafe("Artist//Album")).toBe("/music/Artist/Album");
  });

  it("normalises trailing dot segments", () => {
    expect(resolveSafe("Artist/Album/.")).toBe("/music/Artist/Album");
  });

  it("rejects null bytes", () => {
    expect(resolveSafe("Artist/Album\0/track.mp3")).toBeNull();
  });

  it("rejects newlines", () => {
    expect(resolveSafe("Artist\n/Album")).toBeNull();
  });

  it("rejects tabs", () => {
    expect(resolveSafe("Artist\t/Album")).toBeNull();
  });

  it("rejects other control characters", () => {
    expect(resolveSafe("Artist/\x01Album")).toBeNull();
    expect(resolveSafe("\x7fAlbum")).toBe("/music/\x7fAlbum"); // DEL is not in \x00-\x1f
  });
});

describe("safePathSegment", () => {
  it("replaces slashes with underscores", () => {
    expect(safePathSegment("AC/DC")).toBe("AC_DC");
  });

  it("replaces null bytes with underscores", () => {
    expect(safePathSegment("foo\0bar")).toBe("foo_bar");
  });

  it("passes normal names through unchanged", () => {
    expect(safePathSegment("Normal Name")).toBe("Normal Name");
  });

  it("preserves other special characters", () => {
    expect(safePathSegment("Album (Deluxe Edition)")).toBe("Album (Deluxe Edition)");
    expect(safePathSegment('The "Best" Album')).toBe('The "Best" Album');
  });

  it("handles multiple slashes", () => {
    expect(safePathSegment("A/B/C")).toBe("A_B_C");
  });
});
