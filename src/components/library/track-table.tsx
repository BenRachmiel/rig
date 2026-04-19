"use client";

import { Save } from "lucide-react";
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
  onUpdateField: (idx: number, field: string, value: string | number | null) => void;
  onSaveTrack: (idx: number) => void;
}

function getVal(track: TrackWithTags, field: string) {
  if (field in track.edits) return track.edits[field];
  if (!track.tags) return "";
  return (track.tags as unknown as Record<string, unknown>)[field] ?? "";
}

export function TrackTable({ tracks, saving, onUpdateField, onSaveTrack }: TrackTableProps) {
  return (
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
                  onChange={(e) => onUpdateField(idx, "title", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={String(getVal(track, "artist") ?? "")}
                  onChange={(e) => onUpdateField(idx, "artist", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={String(getVal(track, "genre") ?? "")}
                  onChange={(e) => onUpdateField(idx, "genre", e.target.value)}
                  className="h-7 text-xs border-none bg-transparent px-1 focus-visible:bg-background"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={String(getVal(track, "year") ?? "")}
                  onChange={(e) =>
                    onUpdateField(
                      idx,
                      "year",
                      e.target.value ? Number(e.target.value) : null,
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
                    onClick={() => onSaveTrack(idx)}
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
  );
}
