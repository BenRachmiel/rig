"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Image, Upload, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as libraryApi from "@/lib/library-api";
import type { TrackWithTags } from "@/app/library/[artist]/[album]/page";

interface AlbumCoverSectionProps {
  basePath: string;
  tracks: TrackWithTags[];
  artistName: string;
  albumName: string;
}

export function AlbumCoverSection({ basePath, tracks, artistName, albumName }: AlbumCoverSectionProps) {
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

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [basePath]);

  return (
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
        <Link href={`/reverb?artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}`}>
          <Button variant="outline" size="sm">
            <Headphones className="h-3.5 w-3.5 mr-1.5" />
            Listen in Reverb
          </Button>
        </Link>
      </div>
    </div>
  );
}
