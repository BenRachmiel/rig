import { NextRequest, NextResponse } from "next/server";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "rig/1.0 (https://github.com/rig)";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const album = req.nextUrl.searchParams.get("album");

  if (!artist || !album) {
    return NextResponse.json(
      { error: "artist and album query params required" },
      { status: 400 },
    );
  }

  const query = `release:${album} AND artist:${artist}`;
  const url = `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `MusicBrainz returned ${res.status}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const releases: unknown[] = data.releases ?? [];

  if (releases.length === 0) {
    return NextResponse.json({ error: "No release found" }, { status: 404 });
  }

  const rel = releases[0] as Record<string, unknown>;
  const id = rel.id as string;

  return NextResponse.json({
    url: `https://coverartarchive.org/release/${id}/front-250`,
  });
}
