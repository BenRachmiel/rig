"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronRight, Save, Image, Upload, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as libraryApi from "@/lib/library-api";
import type { LibraryEntry, TagData, MusicBrainzResult } from "@/types/api";

interface TrackWithTags {
  entry: LibraryEntry;
  tags: TagData | null;
  edits: Record<string, string | number | null>;
  dirty: boolean;
}

export default function AlbumPage({
  params,
}: {
  params: Promise<{ artist: string; album: string }>;
}) {
  const { artist, album } = use(params);
  const artistName = decodeURIComponent(artist);
  const albumName = decodeURIComponent(album);
  const basePath = `${artistName}/${albumName}`;

  const [tracks, setTracks] = useState<TrackWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverKey, setCoverKey] = useState(0);

  // Album-level bulk edit state
  const [albumGenre, setAlbumGenre] = useState("");
  const [albumYear, setAlbumYear] = useState("");

  // MusicBrainz lookup state
  const [mbResults, setMbResults] = useState<MusicBrainzResult[]>([]);
  const [mbLoading, setMbLoading] = useState(false);
  const [mbOpen, setMbOpen] = useState(false);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const { entries } = await libraryApi.browse(basePath);
      const files = entries.filter((e) => e.type === "file");

      const loaded = await Promise.all(
        files.map(async (entry) => {
          try {
            const tags = await libraryApi.readTags(entry.path);
            return { entry, tags, edits: {}, dirty: false };
          } catch {
            return { entry, tags: null, edits: {}, dirty: false };
          }
        })
      );

      setTracks(loaded);

      // Initialize album-level fields from first track
      const firstTags = loaded.find((t) => t.tags)?.tags;
      if (firstTags) {
        setAlbumGenre(firstTags.genre ?? "");
        setAlbumYear(firstTags.year != null ? String(firstTags.year) : "");
      }
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // Try filesystem cover first, fall back to embedded
  useEffect(() => {
    const dirUrl = libraryApi.coverDirUrl(basePath);
    fetch(dirUrl, { method: "HEAD" })
      .then((r) => {
        if (r.ok) {
          setCoverSrc(dirUrl);
        } else if (tracks.length > 0 && tracks[0].tags?.hasCover) {
          setCoverSrc(libraryApi.coverUrl(tracks[0].entry.path));
        }
      })
      .catch(() => {});
  }, [basePath, tracks, coverKey]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await libraryApi.uploadCover(basePath, file);
      toast.success("Cover uploaded");
      setCoverKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateField = (
    idx: number,
    field: string,
    value: string | number | null
  ) => {
    setTracks((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, edits: { ...t.edits, [field]: value }, dirty: true }
          : t
      )
    );
  };

  const applyToAllTracks = () => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        edits: {
          ...t.edits,
          genre: albumGenre,
          year: albumYear ? Number(albumYear) : null,
        },
        dirty: true,
      }))
    );
    toast.success("Applied genre & year to all tracks");
  };

  const handleMbLookup = async () => {
    setMbLoading(true);
    setMbResults([]);
    try {
      const results = await libraryApi.musicbrainzLookup(artistName, albumName);
      setMbResults(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setMbLoading(false);
    }
  };

  const applyMbResult = (result: MusicBrainzResult) => {
    if (result.genre) setAlbumGenre(result.genre);
    if (result.year) setAlbumYear(result.year);
    setMbOpen(false);
    toast.success("Applied MusicBrainz metadata");
  };

  const saveTrack = async (idx: number) => {
    const track = tracks[idx];
    if (!track.dirty) return;

    const path = track.entry.path;
    setSaving((prev) => new Set(prev).add(path));

    try {
      await libraryApi.writeTags(path, track.edits);
      toast.success(`Saved: ${track.entry.name}`);
      const tags = await libraryApi.readTags(path);
      setTracks((prev) =>
        prev.map((t, i) =>
          i === idx ? { ...t, tags, edits: {}, dirty: false } : t
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  };

  const saveAll = async () => {
    const dirtyIndices = tracks
      .map((t, i) => (t.dirty ? i : -1))
      .filter((i) => i >= 0);
    for (const idx of dirtyIndices) {
      await saveTrack(idx);
    }
  };

  const dirtyCount = tracks.filter((t) => t.dirty).length;

  const getVal = (track: TrackWithTags, field: string) => {
    if (field in track.edits) return track.edits[field];
    if (!track.tags) return "";
    return (track.tags as unknown as Record<string, unknown>)[field] ?? "";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link href="/library" className="hover:text-foreground transition-colors">
              Library
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href={`/library/${encodeURIComponent(artistName)}`}
              className="hover:text-foreground transition-colors"
            >
              {artistName}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{albumName}</span>
          </nav>
        </div>
        {dirtyCount > 0 && (
          <Button onClick={saveAll} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            Save {dirtyCount} change{dirtyCount !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Cover art */}
      <div className="flex items-center gap-4">
        {coverSrc ? (
          <img
            key={coverKey}
            src={`${coverSrc}${coverSrc.includes("?") ? "&" : "?"}v=${coverKey}`}
            alt="Cover"
            className="w-24 h-24 rounded-lg object-cover border"
          />
        ) : (
          <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
            <Image className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          {coverSrc && (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Image className="h-3.5 w-3.5" />
              Cover art
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {uploading ? "Uploading..." : "Upload cover"}
          </Button>
        </div>
      </div>

      {/* Album-level genre & year bulk edit */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="album-genre">Genre</Label>
          <Input
            id="album-genre"
            value={albumGenre}
            onChange={(e) => setAlbumGenre(e.target.value)}
            placeholder="Genre"
            className="h-8 w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="album-year">Year</Label>
          <Input
            id="album-year"
            value={albumYear}
            onChange={(e) => setAlbumYear(e.target.value)}
            placeholder="Year"
            className="h-8 w-20"
          />
        </div>
        <Button variant="outline" size="sm" onClick={applyToAllTracks}>
          Apply to all tracks
        </Button>

        <Dialog open={mbOpen} onOpenChange={setMbOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMbOpen(true);
                  handleMbLookup();
                }}
              />
            }
          >
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Lookup
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>MusicBrainz Lookup</DialogTitle>
            </DialogHeader>
            {mbLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Searching...
              </p>
            ) : mbResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No results found
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {mbResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="font-medium truncate">{r.title}</span>
                      <span className="text-muted-foreground text-xs truncate">
                        {r.artist}
                        {r.year && ` · ${r.year}`}
                        {r.genre && ` · ${r.genre}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 shrink-0"
                      onClick={() => applyMbResult(r)}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading tracks...
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No audio files found
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead className="w-16">Year</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track, idx) => (
                <TableRow
                  key={track.entry.path}
                  className={track.dirty ? "bg-accent/30" : ""}
                >
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    {String(getVal(track, "track") ?? "")}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={String(getVal(track, "title") ?? "")}
                      onChange={(e) =>
                        updateField(idx, "title", e.target.value)
                      }
                      className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={String(getVal(track, "artist") ?? "")}
                      onChange={(e) =>
                        updateField(idx, "artist", e.target.value)
                      }
                      className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={String(getVal(track, "genre") ?? "")}
                      onChange={(e) =>
                        updateField(idx, "genre", e.target.value)
                      }
                      className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={String(getVal(track, "year") ?? "")}
                      onChange={(e) =>
                        updateField(
                          idx,
                          "year",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background w-16"
                    />
                  </TableCell>
                  <TableCell>
                    {track.dirty && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => saveTrack(idx)}
                        disabled={saving.has(track.entry.path)}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
