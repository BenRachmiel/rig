"use client";

import Link from "next/link";
import { Save, Play } from "lucide-react";
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
import type { TrackWithTags } from "@/app/library/[artist]/[album]/page";

interface TrackTableProps {
  tracks: TrackWithTags[];
  saving: Set<string>;
  artistName: string;
  albumName: string;
  onUpdateField: (idx: number, field: string, value: string | number | null) => void;
  onSaveTrack: (idx: number) => void;
}

export function isValidYear(value: string): boolean {
  return value === "" || /^\d{4}$/.test(value);
}

function getVal(track: TrackWithTags, field: string) {
  if (field in track.edits) return track.edits[field];
  if (!track.tags) return "";
  return (track.tags as unknown as Record<string, unknown>)[field] ?? "";
}

export function TrackTable({ tracks, saving, artistName, albumName, onUpdateField, onSaveTrack }: TrackTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 md:w-12">#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell w-[20%]">Artist</TableHead>
            <TableHead className="hidden md:table-cell w-[15%]">Genre</TableHead>
            <TableHead className="w-14 md:w-16">Year</TableHead>
            <TableHead className="w-10 md:w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tracks.map((track, idx) => (
            <TableRow
              key={track.entry.path}
              className={track.dirty ? "bg-accent/30" : ""}
            >
              <TableCell className="font-mono text-muted-foreground text-xs">
                <span className="group/track inline-flex items-center gap-1">
                  <span className="hidden md:inline md:group-hover/track:hidden">
                    {String(getVal(track, "track") ?? "")}
                  </span>
                  <Link
                    href={`/reverb?artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}&track=${idx + 1}`}
                    className="inline-flex md:hidden md:group-hover/track:inline-flex"
                    title="Play in Reverb"
                  >
                    <Play className="h-3 w-3 fill-current" />
                  </Link>
                </span>
              </TableCell>
              <TableCell className="truncate">
                <Input
                  value={String(getVal(track, "title") ?? "")}
                  onChange={(e) => onUpdateField(idx, "title", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell className="hidden md:table-cell truncate">
                <Input
                  value={String(getVal(track, "artist") ?? "")}
                  onChange={(e) => onUpdateField(idx, "artist", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell className="hidden md:table-cell truncate">
                <Input
                  value={String(getVal(track, "genre") ?? "")}
                  onChange={(e) => onUpdateField(idx, "genre", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell>
                {(() => {
                  const yearVal = String(getVal(track, "year") ?? "");
                  const yearInvalid = !isValidYear(yearVal);
                  return (
                    <Input
                      value={yearVal}
                      onChange={(e) =>
                        onUpdateField(
                          idx,
                          "year",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      className={`h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background w-16 ${yearInvalid ? "ring-1 ring-red-500" : ""}`}
                    />
                  );
                })()}
              </TableCell>
              <TableCell>
                {track.dirty && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onSaveTrack(idx)}
                    disabled={saving.has(track.entry.path) || !isValidYear(String(getVal(track, "year") ?? ""))}
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
  );
}
