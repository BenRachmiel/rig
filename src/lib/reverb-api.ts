import type { SongID3, AlbumWithSongsID3, SubsonicResponse } from "@/types/api";

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

  streamUrl: (id: string): string => `${API}/stream?id=${encodeURIComponent(id)}`,

  coverArtUrl: (id: string, size = 256): string =>
    `${API}/getCoverArt?id=${encodeURIComponent(id)}&size=${size}`,

  scrobble: (id: string): void => {
    fetch(`${API}/scrobble?id=${encodeURIComponent(id)}`).catch(() => {});
  },
};
