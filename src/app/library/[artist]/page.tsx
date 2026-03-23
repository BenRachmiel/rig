"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as libraryApi from "@/lib/library-api";
import type { LibraryEntry } from "@/types/api";

export default function ArtistPage({
  params,
}: {
  params: Promise<{ artist: string }>;
}) {
  const { artist } = use(params);
  const artistName = decodeURIComponent(artist);
  const [albums, setAlbums] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    libraryApi
      .browse(artistName)
      .then((r) => setAlbums(r.entries.filter((e) => e.type === "directory")));
  }, [artistName]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/library">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {artistName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {albums.length} album{albums.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {albums.map((album) => (
          <Link
            key={album.path}
            href={`/library/${encodeURIComponent(artistName)}/${encodeURIComponent(album.name)}`}
            className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{album.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
