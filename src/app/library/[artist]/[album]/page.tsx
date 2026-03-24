"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronLeft, Save, Image, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as libraryApi from "@/lib/library-api";
import type { LibraryEntry, TagData } from "@/types/api";

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
    fetch(dirUrl, { method: "HEAD" }).then((r) => {
      if (r.ok) {
        setCoverSrc(dirUrl);
      } else if (tracks.length > 0 && tracks[0].tags?.hasCover) {
        setCoverSrc(libraryApi.coverUrl(tracks[0].entry.path));
      }
    }).catch(() => {});
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
        <div className="flex items-center gap-2">
          <Link href={`/library/${encodeURIComponent(artistName)}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {albumName}
            </h1>
            <p className="text-sm text-muted-foreground">{artistName}</p>
          </div>
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
