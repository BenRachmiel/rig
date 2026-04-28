"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as libraryApi from "@/lib/library-api";
import { safePathSegment } from "@/lib/safe-path";
import { AlbumHero } from "@/components/library/album-hero";
import { AlbumBulkEditPanel } from "@/components/library/album-bulk-edit";
import { TrackList } from "@/components/library/track-list";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [initialGenre, setInitialGenre] = useState("");
  const [initialYear, setInitialYear] = useState("");

  // Editing state
  const [editing, setEditing] = useState(false);
  const [confirmingExitEdit, setConfirmingExitEdit] = useState(false);

  // Artist rename state
  const [renamingArtist, setRenamingArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState(artistName);
  const [changingArtist, setChangingArtist] = useState(false);
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

  const dirtyCount = tracks.filter((t) => t.dirty).length;

  const toggleEdit = () => {
    if (editing && dirtyCount > 0) {
      setConfirmingExitEdit(true);
      return;
    }
    setEditing(!editing);
  };

  const discardAndExitEdit = () => {
    setTracks((prev) =>
      prev.map((t) => ({ ...t, edits: {}, dirty: false }))
    );
    setEditing(false);
    setConfirmingExitEdit(false);
  };

  // Artist rename
  const startRename = () => {
    setRenamingArtist(true);
    setNewArtistName(artistName);
  };

  const requestChangeArtist = () => {
    const trimmed = newArtistName.trim();
    if (!trimmed || trimmed === artistName) {
      setRenamingArtist(false);
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-4">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
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

      <AlbumHero
        basePath={basePath}
        tracks={tracks}
        artistName={artistName}
        albumName={albumName}
        editing={editing}
        onToggleEdit={toggleEdit}
        dirtyCount={dirtyCount}
        onSaveAll={saveAll}
        initialGenre={initialGenre}
        initialYear={initialYear}
        onStartRename={startRename}
      />

      {renamingArtist && (
        <div className="flex items-center gap-2">
          <Input
            value={newArtistName}
            onChange={(e) => setNewArtistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") requestChangeArtist();
              if (e.key === "Escape") {
                setRenamingArtist(false);
                setNewArtistName(artistName);
              }
            }}
            className="h-8 text-sm max-w-xs"
            placeholder="New artist name"
            autoFocus
            disabled={changingArtist}
          />
          {changingArtist ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Button size="sm" onClick={requestChangeArtist}>
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRenamingArtist(false);
                  setNewArtistName(artistName);
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {editing && (
        <AlbumBulkEditPanel
          artistName={artistName}
          albumName={albumName}
          initialGenre={initialGenre}
          initialYear={initialYear}
          onApplyToAll={applyToAllTracks}
        />
      )}

      {loading ? (
        <div className="rounded-lg border divide-y">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-4" />
            </div>
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No audio files found
        </div>
      ) : (
        <TrackList
          tracks={tracks}
          artistName={artistName}
          albumName={albumName}
          editing={editing}
          saving={saving}
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

      <ConfirmDialog
        open={confirmingExitEdit}
        onOpenChange={setConfirmingExitEdit}
        title="Discard changes?"
        description={`You have ${dirtyCount} unsaved change${dirtyCount !== 1 ? "s" : ""}. Exiting edit mode will discard them.`}
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={discardAndExitEdit}
      />
    </div>
  );
}
