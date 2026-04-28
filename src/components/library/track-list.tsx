"use client";

import Link from "next/link";
import { Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidYear } from "@/lib/validate";
import type { TrackWithTags } from "@/app/library/[artist]/[album]/page";

interface TrackListProps {
  tracks: TrackWithTags[];
  artistName: string;
  albumName: string;
  editing?: boolean;
  saving?: Set<string>;
  onUpdateField?: (idx: number, field: string, value: string | number | null) => void;
  onSaveTrack?: (idx: number) => void;
}

function getVal(track: TrackWithTags, field: string) {
  if (field in track.edits) return track.edits[field];
  if (!track.tags) return "";
  return (track.tags as unknown as Record<string, unknown>)[field] ?? "";
}

export function TrackList({
  tracks,
  artistName,
  albumName,
  editing,
  saving,
  onUpdateField,
  onSaveTrack,
}: TrackListProps) {
  if (editing) {
    return (
      <div className="rounded-lg border divide-y">
        {tracks.map((track, idx) => {
          const yearVal = String(getVal(track, "year") ?? "");
          const yearInvalid = !isValidYear(yearVal);
          return (
            <div
              key={track.entry.path}
              className={`flex items-center gap-3 px-4 py-2.5 ${track.dirty ? "bg-accent/30" : ""}`}
            >
              <span className="w-8 text-right text-sm text-muted-foreground font-mono shrink-0">
                {String(getVal(track, "track") ?? "")}
              </span>
              <Input
                value={String(getVal(track, "title") ?? "")}
                onChange={(e) => onUpdateField?.(idx, "title", e.target.value)}
                className="h-7 text-sm flex-1 min-w-0"
                placeholder="Title"
              />
              <Input
                value={String(getVal(track, "artist") ?? "")}
                onChange={(e) => onUpdateField?.(idx, "artist", e.target.value)}
                className="h-7 text-sm w-[20%] hidden md:block"
                placeholder="Artist"
              />
              <Input
                value={String(getVal(track, "genre") ?? "")}
                onChange={(e) => onUpdateField?.(idx, "genre", e.target.value)}
                className="h-7 text-sm w-[15%] hidden md:block"
                placeholder="Genre"
              />
              <Input
                value={yearVal}
                onChange={(e) =>
                  onUpdateField?.(
                    idx,
                    "year",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                inputMode="numeric"
                pattern="[0-9]{4}"
                placeholder="Year"
                className={`h-7 text-sm w-16 shrink-0 ${yearInvalid ? "ring-1 ring-red-500" : ""}`}
              />
              <div className="w-7 shrink-0">
                {track.dirty && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onSaveTrack?.(idx)}
                    disabled={
                      saving?.has(track.entry.path) || yearInvalid
                    }
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {tracks.map((track, idx) => {
        const trackArtist = String(getVal(track, "artist") ?? "");
        const showArtist = trackArtist && trackArtist !== artistName;
        return (
          <div
            key={track.entry.path}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span className="w-8 text-right text-sm text-muted-foreground font-mono shrink-0">
              {String(getVal(track, "track") ?? "")}
            </span>
            <span className="flex-1 truncate text-sm">
              {String(getVal(track, "title") ?? track.entry.name)}
            </span>
            {showArtist && (
              <span className="text-xs text-muted-foreground truncate max-w-[20%] hidden md:block">
                {trackArtist}
              </span>
            )}
            <Link
              href={`/reverb?artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}&track=${idx + 1}`}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Play in Reverb"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
