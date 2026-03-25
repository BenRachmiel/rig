import { NextRequest } from "next/server";
import { headers as getHeaders } from "next/headers";
import { resolveSafe } from "@/lib/safe-path";
import { PREAMP_ADMIN_URL } from "@/lib/env";

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

  try {
    const NodeID3 = await import("node-id3");

    // Read existing tags so we can merge and control frame order.
    const existing = NodeID3.default.read(resolved);

    const update: Record<string, unknown> = {};
    if (tags.title !== undefined) update.title = tags.title;
    if (tags.artist !== undefined) update.artist = tags.artist;
    if (tags.album !== undefined) update.album = tags.album;
    if (tags.albumArtist !== undefined) update.performerInfo = tags.albumArtist;
    if (tags.genre !== undefined) update.genre = tags.genre;
    if (tags.year !== undefined) update.year = String(tags.year);
    if (tags.track !== undefined) update.trackNumber = String(tags.track);

    // Preamp's ID3 reader only reads 4KB of tag data. Large binary frames
    // (SYLT, APIC, etc.) serialised before text frames push them past the
    // read window. Write only the text fields we care about — skip binary
    // frames entirely. Embedded art and lyrics stay in the file via the
    // raw tag body that node-id3 doesn't touch outside the ID3 header.
    //
    // Actually, node-id3.write() strips the entire old tag and replaces it,
    // so we must preserve non-text data. Put text fields first, then the rest.
    const textKeys = new Set([
      "title", "artist", "album", "performerInfo", "genre", "year",
      "trackNumber", "partOfSet", "composer", "publisher",
    ]);
    const merged = { ...existing, ...update };
    const ordered: Record<string, unknown> = {};
    // Text fields first — these must be within the 4KB read window
    for (const k of textKeys) {
      if (k in merged) ordered[k] = (merged as Record<string, unknown>)[k];
    }
    // Everything else (image, synchronisedLyrics, etc.) after
    for (const [k, v] of Object.entries(merged as Record<string, unknown>)) {
      if (!textKeys.has(k) && k !== "raw") ordered[k] = v;
    }

    const result = NodeID3.default.write(ordered, resolved);

    if (result !== true) {
      return Response.json({ error: "Failed to write tags" }, { status: 500 });
    }

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
  }
}
