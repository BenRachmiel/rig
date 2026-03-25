// Gain types
export interface Album {
  id: number;
  title: string;
  artist: string;
  cover: string;
  tracks: number;
  year: string;
}

export interface Track {
  index: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  url: string;
}

export interface ResolveMeta {
  artist: string;
  album: string;
  matched_artist: string | null;
  existing_artists: string[];
  total: number;
  cover_url?: string;
}

export interface JobState {
  id: string;
  artist: string;
  album: string;
  status: "queued" | "active" | "done" | "error";
  current_track: number | null;
  track_count: number;
  tracks_done: number;
  trackPhase?: "download" | "transcode";
  trackPct?: number;
  trackIndex?: number;
}

export type Job = Omit<JobState, "trackPhase" | "trackPct" | "trackIndex">;

export interface JobUpdateEvent {
  job_id: string;
  status: string;
  artist?: string;
  album?: string;
  track_count?: number;
}

export interface TrackUpdateEvent {
  job_id: string;
  index: number;
  title: string;
  status: string;
  error?: string;
}

export interface TrackProgressEvent {
  job_id: string;
  index: number;
  phase: "download" | "transcode";
  pct: number;
}

export interface LogEvent {
  message: string;
  job_id?: string;
}

// Preamp types
export interface Credential {
  id: string;
  username: string;
  client_name: string;
  legacy_auth: boolean;
  created_at: string;
  expires_at: string;
  expired: boolean;
  secret?: string;
}

export interface Stats {
  artists: number;
  albums: number;
  songs: number;
  albums_missing_art: number;
  songs_unknown_artist: number;
  songs_no_genre: number;
  songs_no_year: number;
  songs_zero_duration: number;
  albums_no_year: number;
  albums_no_genre: number;
}

export interface ScanStatus {
  scanning: boolean;
  count: number;
}

// Issue types
export interface SongIssue {
  title: string;
  artist: string;
  album: string;
  path: string;
  genre: string;
  year: number;
  duration: number;
}

export interface AlbumIssue {
  name: string;
  artist: string;
  year: number;
  genre: string;
  song_count: number;
}

export interface IssuesResponse {
  items: SongIssue[] | AlbumIssue[];
  total: number;
}

// Library types
export interface LibraryEntry {
  name: string;
  type: "directory" | "file";
  path: string;
}

export interface MusicBrainzResult {
  id: string;
  title: string;
  artist: string;
  year: string;
  genre: string;
}

export interface TagData {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  track: number | null;
  trackTotal: number | null;
  disc: number | null;
  duration: number | null;
  bitrate: number | null;
  hasCover: boolean;
}
