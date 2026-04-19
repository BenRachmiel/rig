import { NextRequest, NextResponse } from "next/server";
import { buildReleaseSearchUrl, fetchMusicBrainz } from "@/lib/musicbrainz";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const album = req.nextUrl.searchParams.get("album");

  if (!artist || !album) {
    return NextResponse.json(
      { error: "artist and album query params required" },
      { status: 400 },
    );
  }

  const url = buildReleaseSearchUrl(artist, album, 1);

  let data: Record<string, unknown>;
  try {
    data = await fetchMusicBrainz(url) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "MusicBrainz request failed" },
      { status: 502 },
    );
  }
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
