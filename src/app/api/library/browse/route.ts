import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafe } from "@/lib/safe-path";
import { MUSIC_DIR } from "@/lib/env";

const AUDIO_EXTS = new Set([
  ".mp3", ".flac", ".ogg", ".m4a", ".opus", ".wma", ".wav", ".aac",
]);

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("path") ?? "";
  const resolved = resolveSafe(relativePath);
  if (!resolved) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return Response.json({ error: "Not a directory" }, { status: 400 });
    }

    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    const entries = dirents
      .filter((d) => {
        if (d.name.startsWith(".")) return false;
        if (d.isDirectory()) return true;
        return AUDIO_EXTS.has(path.extname(d.name).toLowerCase());
      })
      .map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("directory" as const) : ("file" as const),
        path: path.relative(MUSIC_DIR, path.join(resolved, d.name)),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return Response.json({ entries });
  } catch {
    return Response.json({ error: "Path not found" }, { status: 404 });
  }
}
