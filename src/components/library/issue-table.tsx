"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Loader2, Wand2 } from "lucide-react";
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
import { safePathSegment } from "@/lib/safe-path";
import type { SongIssue, AlbumIssue } from "@/types/api";

type IssueType = string;

function isSongIssue(type: IssueType): boolean {
  return type.startsWith("songs_");
}

interface Props {
  type: IssueType;
  items: SongIssue[] | AlbumIssue[];
  total: number;
  onLoadMore: () => void;
  onSaved: () => void;
  onFixAll?: () => void;
}

export function IssueTable({ type, items, total, onLoadMore, onSaved, onFixAll }: Props) {
  if (isSongIssue(type)) {
    return (
      <SongIssueTable
        type={type}
        items={items as SongIssue[]}
        total={total}
        onLoadMore={onLoadMore}
        onSaved={onSaved}
        onFixAll={onFixAll}
      />
    );
  }
  return (
    <AlbumIssueTable
      items={items as AlbumIssue[]}
      total={total}
      onLoadMore={onLoadMore}
      onFixAll={onFixAll}
    />
  );
}

function SongIssueTable({
  type,
  items,
  total,
  onLoadMore,
  onSaved,
  onFixAll,
}: {
  type: IssueType;
  items: SongIssue[];
  total: number;
  onLoadMore: () => void;
  onSaved: () => void;
  onFixAll?: () => void;
}) {
  const isArtistType = type === "songs_unknown_artist";
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>(
    {},
  );
  const [saving, setSaving] = useState<Set<number>>(new Set());

  const setEdit = (idx: number, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value },
    }));
  };

  const isDirty = (idx: number) => {
    const e = edits[idx];
    if (!e) return false;
    const song = items[idx];
    return Object.entries(e).some(([k, v]) => {
      const orig = String(song[k as keyof SongIssue] ?? "");
      return v !== orig;
    });
  };

  const saveSong = async (idx: number) => {
    const song = items[idx];
    const e = edits[idx];
    if (!e) return;

    const tags: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(e)) {
      if (k === "year") {
        tags[k] = v ? parseInt(v, 10) : null;
      } else {
        tags[k] = v || null;
      }
    }

    setSaving((prev) => new Set(prev).add(idx));
    try {
      await libraryApi.writeTags(song.path, tags);

      // For artist changes, also move the file
      if (tags.artist && typeof tags.artist === "string" && tags.artist !== song.artist) {
        // Extract album dir from the actual path, not song.album metadata
        const pathParts = song.path.split("/");
        const filename = pathParts.pop()!;
        const albumDir = pathParts.pop() || song.album;
        const newPath = `${safePathSegment(tags.artist as string)}/${albumDir}/${filename}`;
        if (newPath !== song.path) {
          await libraryApi.moveEntry(song.path, newPath);
        }
      }

      toast.success(`Saved tags for "${song.title}"`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      onSaved();
    } catch (err) {
      toast.error(`Failed to save: ${err}`);
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const saveAll = async () => {
    const dirtyIdxs = Object.keys(edits)
      .map(Number)
      .filter((i) => isDirty(i));
    if (dirtyIdxs.length === 0) return;
    for (const idx of dirtyIdxs) {
      await saveSong(idx);
    }
  };

  const dirtyCount = Object.keys(edits)
    .map(Number)
    .filter((i) => isDirty(i)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {total}
        </p>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Button size="sm" onClick={saveAll}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save all ({dirtyCount})
            </Button>
          )}
          {onFixAll && (
            <Button size="sm" variant="outline" onClick={onFixAll}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Fix all
            </Button>
          )}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Album</TableHead>
            <TableHead>Genre</TableHead>
            <TableHead className="w-20">Year</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((song, idx) => (
            <TableRow key={song.path}>
              <TableCell className="font-medium">
                <Link
                  href={`/library/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.album)}`}
                  className="hover:underline"
                >
                  {song.title}
                </Link>
              </TableCell>
              <TableCell>
                {isArtistType ? (
                  <Input
                    className="h-7 w-32"
                    defaultValue={song.artist}
                    onChange={(e) => setEdit(idx, "artist", e.target.value)}
                  />
                ) : (
                  <Link
                    href={`/library/${encodeURIComponent(song.artist)}`}
                    className="hover:underline"
                  >
                    {song.artist}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/library/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.album)}`}
                  className="hover:underline"
                >
                  {song.album}
                </Link>
              </TableCell>
              <TableCell>
                <Input
                  className="h-7 w-32"
                  defaultValue={song.genre}
                  onChange={(e) => setEdit(idx, "genre", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="h-7 w-16"
                  type="number"
                  defaultValue={song.year || ""}
                  onChange={(e) => setEdit(idx, "year", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={!isDirty(idx) || saving.has(idx)}
                  onClick={() => saveSong(idx)}
                >
                  {saving.has(idx) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length < total && (
        <Button variant="outline" size="sm" onClick={onLoadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}

function AlbumIssueTable({
  items,
  total,
  onLoadMore,
  onFixAll,
}: {
  items: AlbumIssue[];
  total: number;
  onLoadMore: () => void;
  onFixAll?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {total}
        </p>
        {onFixAll && (
          <Button size="sm" variant="outline" onClick={onFixAll}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Fix all
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Album</TableHead>
            <TableHead>Artist</TableHead>
            <TableHead className="w-20">Year</TableHead>
            <TableHead>Genre</TableHead>
            <TableHead className="w-16">Songs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((album) => (
            <TableRow key={`${album.artist}/${album.name}`}>
              <TableCell className="font-medium">
                <Link
                  href={`/library/${encodeURIComponent(album.artist)}/${encodeURIComponent(album.name)}`}
                  className="hover:underline"
                >
                  {album.name}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/library/${encodeURIComponent(album.artist)}`}
                  className="hover:underline"
                >
                  {album.artist}
                </Link>
              </TableCell>
              <TableCell>{album.year || "—"}</TableCell>
              <TableCell>{album.genre || "—"}</TableCell>
              <TableCell>{album.song_count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length < total && (
        <Button variant="outline" size="sm" onClick={onLoadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}
