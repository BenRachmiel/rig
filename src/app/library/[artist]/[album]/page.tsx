"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Save, Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as libraryApi from "@/lib/library-api";
import { safePathSegment } from "@/lib/safe-path";
import { AlbumCoverSection } from "@/components/library/album-cover";
import { AlbumBulkEditPanel } from "@/components/library/album-bulk-edit";
import { TrackTable } from "@/components/library/track-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryEntry, TagData } from "@/types/api";

export interface TrackWithTags {
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
  const router = useRouter();
  const artistName = decodeURIComponent(artist);
  const albumName = decodeURIComponent(album);
  const basePath = `${artistName}/${albumName}`;

  const [tracks, setTracks] = useState<TrackWithTags[]>([]);
  const [editingArtist, setEditingArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState(artistName);
  const [changingArtist, setChangingArtist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [initialGenre, setInitialGenre] = useState("");
  const [initialYear, setInitialYear] = useState("");
  const [confirmingRename, setConfirmingRename] = useState(false);

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

      const firstTags = loaded.find((t) => t.tags)?.tags;
      if (firstTags) {
        setInitialGenre(firstTags.genre ?? "");
        setInitialYear(firstTags.year != null ? String(firstTags.year) : "");
      }
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const updateField = (idx: number, field: string, value: string | number | null) => {
    setTracks((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, edits: { ...t.edits, [field]: value }, dirty: true }
          : t
      )
    );
  };

  const applyToAllTracks = (genre: string, year: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        edits: {
          ...t.edits,
          genre,
          year: year ? Number(year) : null,
        },
        dirty: true,
      }))
    );
    toast.success("Applied genre & year to all tracks");
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

  const requestChangeArtist = () => {
    const trimmed = newArtistName.trim();
    if (!trimmed || trimmed === artistName) {
      setEditingArtist(false);
      setNewArtistName(artistName);
      return;
    }
    setConfirmingRename(true);
  };

  const changeArtist = async () => {
    const trimmed = newArtistName.trim();
    setChangingArtist(true);
    try {
      for (const track of tracks) {
        await libraryApi.writeTags(track.entry.path, { artist: trimmed });
      }
      const safeName = safePathSegment(trimmed);
      await libraryApi.moveEntry(basePath, `${safeName}/${albumName}`);
      toast.success(`Moved album to "${trimmed}"`);
      router.replace(
        `/library/${encodeURIComponent(safeName)}/${encodeURIComponent(albumName)}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change artist");
      setChangingArtist(false);
    }
  };

  const dirtyCount = tracks.filter((t) => t.dirty).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/library" className="hover:text-foreground transition-colors">
              Library
            </Link>
            <ChevronRight className="h-3 w-3" />
            {editingArtist ? (
              <span className="inline-flex items-center gap-1">
                <Input
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") requestChangeArtist();
                    if (e.key === "Escape") {
                      setEditingArtist(false);
                      setNewArtistName(artistName);
                    }
                  }}
                  className="h-6 text-sm w-48 px-1"
                  autoFocus
                  disabled={changingArtist}
                />
                {changingArtist ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <button type="button" onClick={requestChangeArtist} className="hover:text-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArtist(false);
                        setNewArtistName(artistName);
                      }}
                      className="hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Link
                  href={`/library/${encodeURIComponent(artistName)}`}
                  className="hover:text-foreground transition-colors"
                >
                  {artistName}
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingArtist(true)}
                  className="hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </span>
            )}
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

      <AlbumCoverSection
        basePath={basePath}
        tracks={tracks}
        artistName={artistName}
        albumName={albumName}
      />

      <AlbumBulkEditPanel
        artistName={artistName}
        albumName={albumName}
        initialGenre={initialGenre}
        initialYear={initialYear}
        onApplyToAll={applyToAllTracks}
      />

      {loading ? (
        <div className="rounded-lg border">
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No audio files found
        </div>
      ) : (
        <TrackTable
          tracks={tracks}
          saving={saving}
          artistName={artistName}
          albumName={albumName}
          onUpdateField={updateField}
          onSaveTrack={saveTrack}
        />
      )}

      <ConfirmDialog
        open={confirmingRename}
        onOpenChange={setConfirmingRename}
        title="Rename artist"
        description={`This will move files on disk from "${artistName}" to "${newArtistName.trim()}". Continue?`}
        confirmLabel="Rename"
        variant="default"
        onConfirm={changeArtist}
      />
    </div>
  );
}
