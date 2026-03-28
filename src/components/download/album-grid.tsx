"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { AlbumCard } from "./album-card";

export function AlbumGrid() {
  const albums = useAppStore((s) => s.albums);
  const searchLoading = useAppStore((s) => s.searchLoading);
  const searchError = useAppStore((s) => s.searchError);
  const hasMore = useAppStore((s) => s.hasMore);
  const loadMore = useAppStore((s) => s.loadMore);

  if (searchLoading && albums.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">Searching...</div>
    );
  }

  if (searchError) {
    return <div className="text-sm text-destructive py-4">{searchError}</div>;
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
