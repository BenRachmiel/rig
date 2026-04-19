import type { SongID3, AlbumWithSongsID3, SubsonicResponse, StructuredLyric } from "@/types/api";

const API = "/api/reverb";

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const reverbApi = {
  getRandomSongs: async (count = 20): Promise<SongID3[]> => {
    const data = await json<SubsonicResponse<{ randomSongs: { song: SongID3[] } }>>(
      `/getRandomSongs?size=${count}`,
    );
    const songs = data["subsonic-response"].randomSongs.song ?? [];
    return songs.filter((s) => s.duration > 45);
  },

  getAlbum: async (id: string): Promise<AlbumWithSongsID3> => {
    const data = await json<SubsonicResponse<{ album: AlbumWithSongsID3 }>>(
      `/getAlbum?id=${encodeURIComponent(id)}`,
    );
    return data["subsonic-response"].album;
  },

  streamUrl: (id: string, startTime?: number, duration?: number): string => {
    let url = `${API}/stream?id=${encodeURIComponent(id)}`;
    if (startTime !== undefined && duration !== undefined) {
      url += `&startTime=${startTime}&duration=${duration}`;
    }
    return url;
  },

  coverArtUrl: (id: string, size = 256): string =>
    `${API}/getCoverArt?id=${encodeURIComponent(id)}&size=${size}`,

  getLyrics: async (songId: string): Promise<StructuredLyric[]> => {
    const data = await json<SubsonicResponse<{ lyricsList?: { structuredLyrics?: StructuredLyric[] } }>>(
      `/getLyricsBySongId?id=${encodeURIComponent(songId)}`,
    );
    return data["subsonic-response"].lyricsList?.structuredLyrics ?? [];
  },

  star: async (songId: string): Promise<void> => {
    const res = await fetch(`${API}/star?id=${encodeURIComponent(songId)}`);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },

  unstar: async (songId: string): Promise<void> => {
    const res = await fetch(`${API}/unstar?id=${encodeURIComponent(songId)}`);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },

  setRating: async (songId: string, rating: number): Promise<void> => {
    const res = await fetch(`${API}/setRating?id=${encodeURIComponent(songId)}&rating=${rating}`);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },

  getStarred: async (): Promise<SongID3[]> => {
    const data = await json<SubsonicResponse<{ starred2?: { song?: SongID3[] } }>>(
      `/getStarred2`,
    );
    return data["subsonic-response"].starred2?.song ?? [];
  },

  searchAlbum: async (artist: string, album: string): Promise<AlbumWithSongsID3 | null> => {
    const query = encodeURIComponent(album);
    const data = await json<SubsonicResponse<{ searchResult3?: { album?: AlbumWithSongsID3[] } }>>(
      `/search3?query=${query}&artistCount=0&songCount=0&albumCount=10`,
    );
    const albums = data["subsonic-response"].searchResult3?.album ?? [];
    const match = albums.find(
      (a) => a.artist.toLowerCase() === artist.toLowerCase() && a.name.toLowerCase() === album.toLowerCase(),
    ) ?? albums.find(
      (a) => a.name.toLowerCase() === album.toLowerCase(),
    ) ?? albums[0] ?? null;

    if (!match) return null;
    // Fetch full album with songs
    return reverbApi.getAlbum(match.id);
  },
};
