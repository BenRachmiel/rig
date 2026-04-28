"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Headphones, Image, MoreHorizontal, Pencil, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import * as libraryApi from "@/lib/library-api";
import type { TrackWithTags } from "@/app/library/[artist]/[album]/page";

interface AlbumHeroProps {
  basePath: string;
  tracks: TrackWithTags[];
  artistName: string;
  albumName: string;
  editing: boolean;
  onToggleEdit: () => void;
  dirtyCount: number;
  onSaveAll: () => void;
  initialGenre: string;
  initialYear: string;
  onStartRename: () => void;
}

export function AlbumHero({
  basePath,
  tracks,
  artistName,
  albumName,
  editing,
  onToggleEdit,
  dirtyCount,
  onSaveAll,
  initialGenre,
  initialYear,
  onStartRename,
}: AlbumHeroProps) {
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [basePath],
  );

  const meta = [initialYear, initialGenre, `${tracks.length} track${tracks.length !== 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-start gap-4">
      {coverSrc ? (
        <img
          key={coverKey}
          src={`${coverSrc}${coverSrc.includes("?") ? "&" : "?"}v=${coverKey}`}
          alt="Cover"
          className="w-20 h-20 md:w-32 md:h-32 rounded-lg object-cover border shrink-0"
        />
      ) : (
        <div className="w-20 h-20 md:w-32 md:h-32 rounded-lg border bg-muted flex items-center justify-center shrink-0">
          <Image className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 min-w-0 py-0.5">
        <h1 className="text-xl md:text-2xl font-bold truncate">{albumName}</h1>
        <Link
          href={`/library/${encodeURIComponent(artistName)}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
        >
          {artistName}
        </Link>
        {meta && (
          <span className="text-xs text-muted-foreground">{meta}</span>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <Link href={`/reverb?artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}`}>
            <Button variant="outline" size="sm">
              <Headphones className="h-3.5 w-3.5 mr-1.5" />
              Listen
            </Button>
          </Link>

          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={onToggleEdit}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {editing ? "Done" : "Edit"}
          </Button>

          {editing && dirtyCount > 0 && (
            <Button size="sm" onClick={onSaveAll}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save {dirtyCount}
            </Button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="h-8 w-8" />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload cover"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onStartRename}>
                <Pencil className="h-4 w-4" />
                Rename artist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
