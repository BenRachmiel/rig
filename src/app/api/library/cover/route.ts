import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { headers as getHeaders } from "next/headers";
import { resolveSafe } from "@/lib/safe-path";
import { PREAMP_ADMIN_URL } from "@/lib/env";

const COVER_NAMES = ["cover.jpg", "cover.png", "folder.jpg"];

async function findCoverFile(dir: string): Promise<{ path: string; mime: string } | null> {
  for (const name of COVER_NAMES) {
    const full = path.join(dir, name);
    try {
      await fs.access(full);
      const mime = name.endsWith(".png") ? "image/png" : "image/jpeg";
      return { path: full, mime };
    } catch {
      // not found, try next
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const dir = request.nextUrl.searchParams.get("dir");
  const file = request.nextUrl.searchParams.get("file");

  // Filesystem cover from directory
  if (dir) {
    const resolved = resolveSafe(dir);
    if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

    const cover = await findCoverFile(resolved);
    if (cover) {
      const data = await fs.readFile(cover.path);
      return new Response(data, {
        headers: {
          "content-type": cover.mime,
          "cache-control": "public, max-age=3600",
        },
      });
    }
    return Response.json({ error: "No cover art" }, { status: 404 });
  }

  // Embedded cover from file
  if (!file) return Response.json({ error: "file or dir param required" }, { status: 400 });

  const resolved = resolveSafe(file);
  if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

  try {
    const mm = await import("music-metadata");
    const metadata = await mm.parseFile(resolved);
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      return Response.json({ error: "No cover art" }, { status: 404 });
    }

    return new Response(Buffer.from(picture.data), {
      headers: {
        "content-type": picture.format,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "Failed to read cover" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const dir = formData.get("dir") as string;
  const image = formData.get("image") as File;

  if (!dir || !image) {
    return Response.json({ error: "dir and image required" }, { status: 400 });
  }

  const resolved = resolveSafe(dir);
  if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    await fs.writeFile(path.join(resolved, "cover.jpg"), buffer);

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
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as string;
  const image = formData.get("image") as File;

  if (!file || !image) {
    return Response.json({ error: "file and image required" }, { status: 400 });
  }

  const resolved = resolveSafe(file);
  if (!resolved) return Response.json({ error: "Invalid path" }, { status: 400 });

  try {
    const NodeID3 = await import("node-id3");
    const buffer = Buffer.from(await image.arrayBuffer());

    const tags = {
      image: {
        mime: image.type,
        type: { id: 3, name: "front cover" as const },
        description: "Cover",
        imageBuffer: buffer,
      },
    };

    const result = NodeID3.default.update(tags, resolved);
    if (result !== true) {
      return Response.json({ error: "Failed to embed cover" }, { status: 500 });
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
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
