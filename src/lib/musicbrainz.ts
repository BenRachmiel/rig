/** Escape Lucene special characters: + - & | ! ( ) { } [ ] ^ " ~ * ? : \ / */
export function escapeLucene(s: string): string {
  return s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "rig/1.0 (https://github.com/rig)";

export function buildReleaseSearchUrl(artist: string, album: string, limit: number): string {
  const query = `release:${escapeLucene(album)} AND artist:${escapeLucene(artist)}`;
  return `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
}

export async function fetchMusicBrainz(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MusicBrainz returned ${res.status}`);
  return res.json();
}
