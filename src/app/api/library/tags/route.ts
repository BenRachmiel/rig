import { NextRequest } from "next/server";
import { headers as getHeaders } from "next/headers";
import { resolveSafe } from "@/lib/safe-path";
import { PREAMP_ADMIN_URL } from "@/lib/env";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rename, unlink, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file");
  if (!file) return Response.json({ error: "file param required" }, { status: 400 });

  const resolved = resolveSafe(file);
  if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

  try {
    const mm = await import("music-metadata");
    const metadata = await mm.parseFile(resolved);
    const { common, format } = metadata;

    return Response.json({
      title: common.title ?? null,
      artist: common.artist ?? null,
      album: common.album ?? null,
      albumArtist: common.albumartist ?? null,
      genre: common.genre?.[0] ?? null,
      year: common.year ?? null,
      track: common.track?.no ?? null,
      trackTotal: common.track?.of ?? null,
      disc: common.disk?.no ?? null,
      duration: format.duration ? Math.round(format.duration) : null,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      hasCover: (common.picture?.length ?? 0) > 0,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to read tags" },
      { status: 500 }
    );
  }
}

/** Parse the ID3v2 header to find where audio data starts. Returns 0 if no ID3v2 tag. */
async function getID3v2Size(filePath: string): Promise<number> {
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(10);
    const { bytesRead } = await fh.read(buf, 0, 10, 0);
    if (bytesRead < 10) return 0;
    // ID3v2 header: "ID3" + version(2) + flags(1) + size(4 syncsafe)
    if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0;
    const size =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);
    return 10 + size; // header (10 bytes) + tag body
  } finally {
    await fh.close();
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { file, tags } = body as {
    file: string;
    tags: Record<string, string | number | null>;
  };

  if (!file || !tags) {
    return Response.json({ error: "file and tags required" }, { status: 400 });
  }

  const resolved = resolveSafe(file);
  if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

  let tmpPath: string | null = null;
  try {
    // Read existing tags via music-metadata (streaming, low memory)
    const mm = await import("music-metadata");
    const metadata = await mm.parseFile(resolved);
    const { common } = metadata;

    // Map music-metadata fields to node-id3 tag names
    const existing: Record<string, unknown> = {};
    if (common.title) existing.title = common.title;
    if (common.artist) existing.artist = common.artist;
    if (common.album) existing.album = common.album;
    if (common.albumartist) existing.performerInfo = common.albumartist;
    if (common.genre?.[0]) existing.genre = common.genre[0];
    if (common.year) existing.year = String(common.year);
    if (common.track?.no) existing.trackNumber = String(common.track.no);
    if (common.disk?.no) existing.partOfSet = String(common.disk.no);
    if (common.picture?.length) {
      existing.image = {
        mime: common.picture[0].format,
        type: { id: common.picture[0].type ?? 3 },
        description: common.picture[0].description ?? "",
        imageBuffer: Buffer.from(common.picture[0].data),
      };
    }

    // Build update from incoming tags
    const update: Record<string, unknown> = {};
    if (tags.title !== undefined) update.title = tags.title;
    if (tags.artist !== undefined) update.artist = tags.artist;
    if (tags.album !== undefined) update.album = tags.album;
    if (tags.albumArtist !== undefined) update.performerInfo = tags.albumArtist;
    if (tags.genre !== undefined) update.genre = tags.genre;
    if (tags.year !== undefined) update.year = String(tags.year);
    if (tags.track !== undefined) update.trackNumber = String(tags.track);

    // Merge: text fields first (must be within Preamp's 4KB read window), then the rest
    const textKeys = new Set([
      "title", "artist", "album", "performerInfo", "genre", "year",
      "trackNumber", "partOfSet", "composer", "publisher",
    ]);
    const merged = { ...existing, ...update };
    const ordered: Record<string, unknown> = {};
    for (const k of textKeys) {
      if (k in merged) ordered[k] = (merged as Record<string, unknown>)[k];
    }
    for (const [k, v] of Object.entries(merged as Record<string, unknown>)) {
      if (!textKeys.has(k)) ordered[k] = v;
    }

    // Build the new ID3v2 tag buffer (small — just tag frames, no audio data)
    const NodeID3 = await import("node-id3");
    const tagBuffer = NodeID3.create(ordered);
    if (!Buffer.isBuffer(tagBuffer)) {
      return Response.json({ error: "Failed to create tag buffer" }, { status: 500 });
    }

    // Find where existing audio data starts (skip old ID3v2 tag)
    const audioDataOffset = await getID3v2Size(resolved);

    // Stream: new tags + audio data → temp file, then atomic rename
    // Temp file must be on the same filesystem as the target for rename() to work
    tmpPath = join(dirname(resolved), `.rig-tag-${randomBytes(8).toString("hex")}.tmp`);
    const fileStat = await stat(resolved);

    const ws = createWriteStream(tmpPath);

    // Write new tag buffer
    await new Promise<void>((resolve, reject) => {
      ws.write(tagBuffer, (err) => (err ? reject(err) : resolve()));
    });

    // Stream audio data from original file (skipping old ID3v2 header)
    const rs = createReadStream(resolved, { start: audioDataOffset });
    await pipeline(rs, ws);

    // Preserve original file permissions
    const { chmod } = await import("node:fs/promises");
    await chmod(tmpPath, fileStat.mode & 0o7777);

    // Atomic rename
    await rename(tmpPath, resolved);
    tmpPath = null; // prevent cleanup

    // Trigger Preamp rescan
    const h = await getHeaders();
    const user = h.get("x-forwarded-user") || h.get("remote-user");
    const scanHeaders: Record<string, string> = user ? { "remote-user": user } : {};
    fetch(`${PREAMP_ADMIN_URL}/admin/scan`, {
      method: "POST",
      headers: scanHeaders,
    }).catch(() => {});

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to write tags" },
      { status: 500 }
    );
  } finally {
    // Clean up temp file on failure
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {});
    }
  }
}
