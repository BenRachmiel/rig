"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { AlbumCard } from "./album-card";

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

export function AlbumGrid() {
  const albums = useAppStore((s) => s.albums);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const hasMore = useAppStore((s) => s.hasMore);
  const loadMore = useAppStore((s) => s.loadMore);

  if (searchLoading && albums.length === 0) {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (searchError) {
    return <div className="text-sm text-destructive py-4">{searchError}</div>;
  }

  if (albums.length === 0 && !searchQuery) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Search for an album to get started
      </p>
    );
  }

  if (albums.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadMore}
            disabled={searchLoading}
          >
            {searchLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
