"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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
import * as libraryApi from "@/lib/library-api";
import { isValidYear } from "@/lib/validate";
import type { MusicBrainzResult } from "@/types/api";

interface AlbumBulkEditPanelProps {
  artistName: string;
  albumName: string;
  initialGenre: string;
  initialYear: string;
  onApplyToAll: (genre: string, year: string) => void;
}

export function AlbumBulkEditPanel({
  artistName,
  albumName,
  initialGenre,
  initialYear,
  onApplyToAll,
}: AlbumBulkEditPanelProps) {
  const [albumGenre, setAlbumGenre] = useState(initialGenre);
  const [albumYear, setAlbumYear] = useState(initialYear);
  const [mbResults, setMbResults] = useState<MusicBrainzResult[]>([]);
  const [mbLoading, setMbLoading] = useState(false);
  const [mbOpen, setMbOpen] = useState(false);

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

  return (
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
          inputMode="numeric"
          pattern="[0-9]{4}"
          placeholder="Year"
          className={`h-8 w-20 ${!isValidYear(albumYear) ? "ring-1 ring-red-500" : ""}`}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onApplyToAll(albumGenre, albumYear)}
        disabled={!isValidYear(albumYear)}
      >
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
                      {r.year && ` \u00b7 ${r.year}`}
                      {r.genre && ` \u00b7 ${r.genre}`}
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
  );
}
