import { NextRequest, NextResponse } from "next/server";
import { buildReleaseSearchUrl, fetchMusicBrainz } from "@/lib/musicbrainz";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist");
  const album = req.nextUrl.searchParams.get("album");

  if (!artist || !album) {
    return NextResponse.json(
      { error: "artist and album query params required" },
      { status: 400 }
    );
  }

  const url = buildReleaseSearchUrl(artist, album, 5);

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
