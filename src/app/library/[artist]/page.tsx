"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/library" className="hover:text-foreground transition-colors">
            Library
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{artistName}</span>
        </nav>
        <p className="text-xs text-muted-foreground">
          {albums.length} album{albums.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {albums.map((album) => (
          <Link
            key={album.path}
            href={`/library/${encodeURIComponent(artistName)}/${encodeURIComponent(album.name)}`}
            className="group flex flex-col rounded-lg border bg-card hover:bg-accent transition-colors overflow-hidden"
          >
            <div className="aspect-square bg-muted relative">
              <img
                src={libraryApi.coverDirUrl(album.path)}
                alt={album.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="px-3 py-2 text-sm truncate">{album.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
