"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Upload,
  Search,
  SkipForward,
  Save,
  Image,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as libraryApi from "@/lib/library-api";
import { preampApi } from "@/lib/preamp-api";
import { safePathSegment } from "@/lib/safe-path";
import type { SongIssue, AlbumIssue } from "@/types/api";

type IssueKey =
  | "albums_missing_art"
  | "albums_no_year"
  | "albums_no_genre"
  | "songs_unknown_artist"
  | "songs_no_genre"
  | "songs_no_year"
  | "songs_zero_duration";

type Variant = "album-metadata" | "album-art" | "song-metadata" | "song-artist";

interface IssueWizardProps {
  issueType: IssueKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  existingArtists?: string[];
}

interface SongGroup {
  key: string;
  artist: string;
  album: string;
  songs: SongIssue[];
}

const VARIANT_MAP: Record<IssueKey, Variant> = {
  albums_no_year: "album-metadata",
  albums_no_genre: "album-metadata",
  albums_missing_art: "album-art",
  songs_no_year: "song-metadata",
  songs_no_genre: "song-metadata",
  songs_unknown_artist: "song-artist",
  songs_zero_duration: "song-metadata",
};

const TITLES: Record<Variant, string> = {
  "album-metadata": "Fix Album Metadata",
  "album-art": "Fix Album Art",
  "song-metadata": "Fix Song Metadata",
  "song-artist": "Fix Song Artist",
};

function isSongType(type: IssueKey): boolean {
  return type.startsWith("songs_");
}

function groupSongs(songs: SongIssue[]): SongGroup[] {
  const map = new Map<string, SongGroup>();
  for (const song of songs) {
    const key = `${song.artist}/${song.album}`;
    let group = map.get(key);
    if (!group) {
      group = { key, artist: song.artist, album: song.album, songs: [] };
      map.set(key, group);
    }
    group.songs.push(song);
  }
  return Array.from(map.values());
}

export function IssueWizard({
  issueType,
  open,
  onOpenChange,
  onComplete,
  existingArtists = [],
}: IssueWizardProps) {
  const variant = VARIANT_MAP[issueType];

  // Data
  const [items, setItems] = useState<(AlbumIssue | SongIssue)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Navigation
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolved, setResolved] = useState(0);

  // Fields
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [artist, setArtist] = useState("");
  const [songFields, setSongFields] = useState<
    { genre: string; year: string }[]
  >([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Album art
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [mbCoverUrl, setMbCoverUrl] = useState<string | null>(null);
  const [searchingCover, setSearchingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saving
  const [saving, setSaving] = useState(false);

  // MusicBrainz metadata lookup (for album metadata variant)
  const [lookingUp, setLookingUp] = useState(false);

  const songGroups = isSongType(issueType)
    ? groupSongs(items as SongIssue[])
    : [];
  const stepCount = isSongType(issueType)
    ? songGroups.length
    : (items as AlbumIssue[]).length;
  const currentGroup = isSongType(issueType)
    ? songGroups[currentIndex]
    : undefined;
  const currentAlbum = !isSongType(issueType)
    ? (items as AlbumIssue[])[currentIndex]
    : undefined;

  const fetchItems = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const data = await preampApi.issues(issueType, 50, offset);
        if (offset > 0) {
          setItems((prev) => [
            ...prev,
            ...data.items,
          ] as (AlbumIssue | SongIssue)[]);
        } else {
          setItems(data.items as (AlbumIssue | SongIssue)[]);
        }
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [issueType],
  );

  // Initial fetch
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setResolved(0);
      setItems([]);
      resetFields();
      fetchItems(0);
    }
  }, [open, fetchItems]);

  // Init fields when current item changes
  useEffect(() => {
    resetFields();
    if (variant === "song-metadata" && currentGroup) {
      setSongFields(
        currentGroup.songs.map((s) => ({
          genre: s.genre || "",
          year: s.year ? String(s.year) : "",
        })),
      );
    }
    if (variant === "album-metadata" && currentAlbum) {
      setGenre(currentAlbum.genre || "");
      setYear(currentAlbum.year ? String(currentAlbum.year) : "");
    }
    if (variant === "song-artist" && currentGroup) {
      setArtist("");
      setArtistQuery("");
    }
  }, [currentIndex, variant, stepCount]);

  function resetFields() {
    setGenre("");
    setYear("");
    setArtist("");
    setArtistQuery("");
    setSongFields([]);
    setCoverFile(null);
    setCoverPreview(null);
    setMbCoverUrl(null);
    setShowSuggestions(false);
  }

  const advance = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= stepCount) {
      // Check if we need more data
      if (items.length < total) {
        fetchItems(items.length);
      }
      onComplete();
      onOpenChange(false);
      return;
    }
    // Prefetch next page if nearing end
    if (isSongType(issueType) && nextIdx >= songGroups.length - 2 && items.length < total) {
      fetchItems(items.length);
    } else if (!isSongType(issueType) && nextIdx >= items.length - 2 && items.length < total) {
      fetchItems(items.length);
    }
    setCurrentIndex(nextIdx);
  };

  // Save handlers
  const saveAlbumMetadata = async () => {
    if (!currentAlbum) return;
    setSaving(true);
    try {
      const albumPath = `${safePathSegment(currentAlbum.artist)}/${safePathSegment(currentAlbum.name)}`;
      const { entries } = await libraryApi.browse(albumPath);
      const audioFiles = entries.filter((e) => e.type === "file");

      const tags: Record<string, string | number | null> = {};
      if (genre) tags.genre = genre;
      if (year) tags.year = parseInt(year, 10);

      for (const file of audioFiles) {
        await libraryApi.writeTags(file.path, tags);
      }

      toast.success(`Updated ${audioFiles.length} tracks in "${currentAlbum.name}"`);
      setResolved((r) => r + 1);
      advance();
    } catch (err) {
      toast.error(`Failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const saveAlbumArt = async () => {
    if (!currentAlbum) return;
    const albumPath = `${safePathSegment(currentAlbum.artist)}/${safePathSegment(currentAlbum.name)}`;

    setSaving(true);
    try {
      if (coverFile) {
        await libraryApi.uploadCover(albumPath, coverFile);
      } else if (mbCoverUrl) {
        const res = await fetch(mbCoverUrl);
        if (!res.ok) throw new Error("Failed to download cover");
        const blob = await res.blob();
        const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
        await libraryApi.uploadCover(albumPath, file);
      } else {
        toast.error("No cover selected");
        setSaving(false);
        return;
      }
      toast.success(`Cover added to "${currentAlbum.name}"`);
      setResolved((r) => r + 1);
      advance();
    } catch (err) {
      toast.error(`Failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSongMetadata = async () => {
    if (!currentGroup) return;
    setSaving(true);
    try {
      for (let i = 0; i < currentGroup.songs.length; i++) {
        const song = currentGroup.songs[i];
        const fields = songFields[i];
        if (!fields) continue;

        const tags: Record<string, string | number | null> = {};
        if (fields.genre) tags.genre = fields.genre;
        if (fields.year) tags.year = parseInt(fields.year, 10);

        await libraryApi.writeTags(song.path, tags);
      }

      toast.success(
        `Updated ${currentGroup.songs.length} tracks in "${currentGroup.album}"`,
      );
      setResolved((r) => r + 1);
      advance();
    } catch (err) {
      toast.error(`Failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSongArtist = async () => {
    if (!currentGroup || !artist.trim()) return;
    setSaving(true);
    try {
      const newArtist = artist.trim();
      for (const song of currentGroup.songs) {
        await libraryApi.writeTags(song.path, { artist: newArtist });
        // Extract album dir from the actual path, not song.album metadata
        // Path structure: artist/album/file.mp3
        const parts = song.path.split("/");
        const filename = parts.pop()!;
        const albumDir = parts.pop() || song.album;
        const newPath = `${safePathSegment(newArtist)}/${albumDir}/${filename}`;
        if (newPath !== song.path) {
          await libraryApi.moveEntry(song.path, newPath);
        }
      }

      toast.success(
        `Moved ${currentGroup.songs.length} tracks to "${newArtist}"`,
      );
      setResolved((r) => r + 1);
      advance();
    } catch (err) {
      toast.error(`Failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    switch (variant) {
      case "album-metadata":
        return saveAlbumMetadata();
      case "album-art":
        return saveAlbumArt();
      case "song-metadata":
        return saveSongMetadata();
      case "song-artist":
        return saveSongArtist();
    }
  };

  const handleSkip = () => {
    advance();
  };

  // MusicBrainz metadata lookup for album
  const handleMbLookup = async () => {
    if (!currentAlbum) return;
    setLookingUp(true);
    try {
      const results = await libraryApi.musicbrainzLookup(
        currentAlbum.artist,
        currentAlbum.name,
      );
      if (results.length > 0) {
        const best = results[0];
        if (best.genre && !genre) setGenre(best.genre);
        if (best.year && !year) setYear(best.year);
        toast.success("Filled from MusicBrainz");
      } else {
        toast.info("No results found on MusicBrainz");
      }
    } catch (err) {
      toast.error(`MusicBrainz lookup failed: ${err}`);
    } finally {
      setLookingUp(false);
    }
  };

  // MusicBrainz cover art lookup
  const handleMbCoverSearch = async () => {
    if (!currentAlbum) return;
    setSearchingCover(true);
    setMbCoverUrl(null);
    try {
      const result = await libraryApi.musicbrainzCover(
        currentAlbum.artist,
        currentAlbum.name,
      );
      if (result) {
        setMbCoverUrl(result.url);
        setCoverFile(null);
        setCoverPreview(null);
      } else {
        toast.info("No cover art found on MusicBrainz");
      }
    } catch (err) {
      toast.error(`Cover search failed: ${err}`);
    } finally {
      setSearchingCover(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setMbCoverUrl(null);
  };

  const applySongFieldsToAll = () => {
    if (songFields.length === 0) return;
    const first = songFields[0];
    setSongFields(songFields.map(() => ({ ...first })));
  };

  const updateSongField = (
    idx: number,
    field: "genre" | "year",
    value: string,
  ) => {
    setSongFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Artist autocomplete
  const filteredArtists = artistQuery.length > 0
    ? existingArtists
        .filter((a) => a.toLowerCase().includes(artistQuery.toLowerCase()))
        .slice(0, 5)
    : [];

  const canSave = () => {
    switch (variant) {
      case "album-metadata":
        return genre.trim() !== "" || year.trim() !== "";
      case "album-art":
        return coverFile !== null || mbCoverUrl !== null;
      case "song-metadata":
        return songFields.some((f) => f.genre.trim() || f.year.trim());
      case "song-artist":
        return artist.trim() !== "";
    }
  };

  const progressPct = total > 0 ? Math.round(((currentIndex + resolved) / total) * 100) : 0;

  if (loading && items.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (stepCount === 0 && !loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{TITLES[variant]}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            No issues to resolve.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader>
          <DialogTitle>{TITLES[variant]}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {currentIndex + 1} of {stepCount}
              {items.length < total ? "+" : ""}
            </span>
            {resolved > 0 && (
              <span className="text-green-600">({resolved} fixed)</span>
            )}
          </div>
          <Progress value={progressPct} />
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
          {/* Item info card */}
          {variant === "album-metadata" && currentAlbum && (
            <AlbumInfoCard album={currentAlbum} />
          )}
          {variant === "album-art" && currentAlbum && (
            <AlbumInfoCard album={currentAlbum} />
          )}
          {(variant === "song-metadata" || variant === "song-artist") &&
            currentGroup && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="font-medium">{currentGroup.album}</p>
                <p className="text-sm text-muted-foreground">
                  {currentGroup.artist} &middot; {currentGroup.songs.length}{" "}
                  track{currentGroup.songs.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}

          {/* Album metadata fields */}
          {variant === "album-metadata" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Genre</label>
                <Input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Rock, Electronic, Jazz"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Year</label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2020"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMbLookup}
                disabled={lookingUp}
              >
                {lookingUp ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                )}
                MusicBrainz Lookup
              </Button>
            </div>
          )}

          {/* Album art fields */}
          {variant === "album-art" && (
            <div className="space-y-3">
              {/* Cover preview */}
              {(coverPreview || mbCoverUrl) && (
                <div className="flex justify-center">
                  <img
                    src={coverPreview || mbCoverUrl || undefined}
                    alt="Cover preview"
                    className="h-48 w-48 rounded-lg object-cover border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      toast.error("Cover image could not be loaded");
                      setMbCoverUrl(null);
                    }}
                  />
                </div>
              )}

              {!coverPreview && !mbCoverUrl && (
                <div className="flex justify-center">
                  <div className="h-48 w-48 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                    <Image className="h-12 w-12" />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleMbCoverSearch}
                  disabled={searchingCover}
                >
                  {searchingCover ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  MusicBrainz Cover
                </Button>
              </div>
            </div>
          )}

          {/* Song metadata fields */}
          {variant === "song-metadata" && currentGroup && (
            <div className="space-y-3">
              {currentGroup.songs.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applySongFieldsToAll}
                  disabled={songFields.length === 0}
                >
                  Apply first to all
                </Button>
              )}

              <div className="space-y-2">
                {currentGroup.songs.map((song, i) => (
                  <div
                    key={song.path}
                    className="rounded-lg border p-2.5 space-y-1.5"
                  >
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <div className="flex gap-2">
                      <Input
                        className="h-7 flex-1"
                        placeholder="Genre"
                        value={songFields[i]?.genre ?? ""}
                        onChange={(e) =>
                          updateSongField(i, "genre", e.target.value)
                        }
                      />
                      <Input
                        className="h-7 w-20"
                        type="number"
                        placeholder="Year"
                        value={songFields[i]?.year ?? ""}
                        onChange={(e) =>
                          updateSongField(i, "year", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Song artist field */}
          {variant === "song-artist" && currentGroup && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Artist</label>
                <p className="text-xs text-muted-foreground">
                  Tags will be updated and files moved to the new artist folder.
                </p>
                <div className="relative">
                  <Input
                    value={artist || artistQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setArtist("");
                      setArtistQuery(val);
                      setShowSuggestions(val.length > 0);
                    }}
                    onFocus={() => {
                      if (artistQuery.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder="Type artist name..."
                  />
                  {showSuggestions && filteredArtists.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-lg border bg-popover shadow-md">
                      {filteredArtists.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setArtist(a);
                            setArtistQuery(a);
                            setShowSuggestions(false);
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Songs list (read-only) */}
              <div className="space-y-1">
                {currentGroup.songs.map((song) => (
                  <div
                    key={song.path}
                    className="rounded border px-2.5 py-1.5 text-sm truncate"
                  >
                    {song.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            <SkipForward className="h-3.5 w-3.5 mr-1.5" />
            Skip
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave()}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save & Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlbumInfoCard({ album }: { album: AlbumIssue }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <p className="font-medium">{album.name}</p>
      <p className="text-sm text-muted-foreground">
        {album.artist} &middot; {album.song_count} track
        {album.song_count !== 1 ? "s" : ""}
        {album.year ? ` &middot; ${album.year}` : ""}
      </p>
    </div>
  );
}
