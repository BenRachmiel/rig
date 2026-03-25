import { NextRequest, NextResponse } from "next/server";
import { escapeLucene } from "@/lib/musicbrainz";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "rig/1.0 (https://github.com/rig)";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const album = req.nextUrl.searchParams.get("album");

  if (!artist || !album) {
    return NextResponse.json(
      { error: "artist and album query params required" },
      { status: 400 }
    );
  }

  const query = `release:${escapeLucene(album)} AND artist:${escapeLucene(artist)}`;
  const url = `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `MusicBrainz returned ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const releases: unknown[] = data.releases ?? [];

  const results = releases.map((r: unknown) => {
    const rel = r as Record<string, unknown>;
    const artistCredit = rel["artist-credit"] as
      | { name: string }[]
      | undefined;
    const tags = rel.tags as { name: string; count: number }[] | undefined;
    const date = (rel.date as string) ?? "";

    return {
      id: rel.id as string,
      title: rel.title as string,
      artist: artistCredit?.[0]?.name ?? "",
      year: date.slice(0, 4),
      genre:
        tags && tags.length > 0
          ? [...tags].sort((a, b) => b.count - a.count)[0].name
          : "",
    };
  });

  return NextResponse.json({ results });
}
