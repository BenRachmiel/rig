import { NextRequest } from "next/server";
import { headers as getHeaders } from "next/headers";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafe } from "@/lib/safe-path";
import { PREAMP_ADMIN_URL } from "@/lib/env";

export async function POST(request: NextRequest) {
  const { from, to } = (await request.json()) as { from: string; to: string };

  if (!from || !to) {
    return Response.json({ error: "from and to required" }, { status: 400 });
  }

  const resolvedFrom = resolveSafe(from);
  const resolvedTo = resolveSafe(to);

  if (!resolvedFrom || !resolvedTo) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // Ensure source exists
    await fs.access(resolvedFrom);

    // Create target parent directory
    await fs.mkdir(path.dirname(resolvedTo), { recursive: true });

    // Move
    await fs.rename(resolvedFrom, resolvedTo);

    // Clean up empty parent directories
    let parent = path.dirname(resolvedFrom);
    const musicDirResolved = resolveSafe("");
    while (parent !== musicDirResolved && parent.length > (musicDirResolved?.length ?? 0)) {
      const entries = await fs.readdir(parent);
      if (entries.length > 0) break;
      await fs.rmdir(parent);
      parent = path.dirname(parent);
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
      { error: e instanceof Error ? e.message : "Move failed" },
      { status: 500 }
    );
  }
}
