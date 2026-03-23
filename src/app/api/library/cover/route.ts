import { NextRequest } from "next/server";
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
    fetch(`${PREAMP_ADMIN_URL}/admin/scan`, { method: "POST" }).catch(() => {});

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
