"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import type { Album } from "@/types/api";

const RING_CIRC = 87.96;

function KindLabel({ album }: { album: Album }) {
  if (album.source !== "youtube") return null;
  const label = album.kind === "playlist" ? "Playlist" : "Video";
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
      {label}
    </span>
  );
}

function SourceBadge({ album }: { album: Album }) {
  if (!album.source || album.source === "tidal") return null;
  return (
    <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-600/80 text-white font-medium leading-none z-10">
      YT
    </span>
  );
}

export function AlbumCard({ album }: { album: Album }) {
  const [imgError, setImgError] = useState(false);
  const resolvingAlbumId = useAppStore((s) => s.resolvingAlbumId);
  const resolvedCount = useAppStore((s) => s.resolvedCount);
  const totalTracks = useAppStore((s) => s.totalTracks);
  const startResolve = useAppStore((s) => s.startResolve);
  const setDockTab = useAppStore((s) => s.setDockTab);
  const setDockOpen = useAppStore((s) => s.setDockOpen);

  const isResolving = resolvingAlbumId === album.id;
  const ringOffset =
    totalTracks > 0
      ? RING_CIRC * (1 - resolvedCount / totalTracks)
      : RING_CIRC;

  const handleClick = () => {
    if (isResolving) return;
    startResolve(album.id);
    setDockTab("preview");
    setDockOpen(true);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-card cursor-pointer transition-colors hover:border-muted-foreground/30 min-h-[44px] ${isResolving ? "pointer-events-none" : ""}`}
      onClick={handleClick}
    >
      <SourceBadge album={album} />
      {!imgError && album.cover ? (
        <img
          src={album.cover}
          alt=""
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full aspect-square object-cover bg-muted"
        />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-3xl">
          {"\u266B"}
        </div>
      )}
      <div className="p-2">
        <div className="text-sm truncate" title={album.title}>
          {album.title}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {album.artist}
        </div>
        <div className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
          {album.year && <span>{album.year}</span>}
          {album.year && <span>&middot;</span>}
          <span>{album.tracks} {album.tracks === 1 ? "track" : "tracks"}</span>
          <KindLabel album={album} />
        </div>
      </div>

      {isResolving && (
        <div className="absolute inset-0 bg-background/85 flex flex-col items-center justify-center gap-2">
          <svg
            className="-rotate-90 overflow-visible"
            viewBox="0 0 36 36"
            width={44}
            height={44}
          >
            <circle
              cx={18}
              cy={18}
              r={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="text-muted"
            />
            <circle
              cx={18}
              cy={18}
              r={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={ringOffset}
              className="text-muted-foreground transition-all duration-300"
            />
          </svg>
          <span className="text-xs text-muted-foreground">
            {resolvedCount} / {totalTracks || "?"}
          </span>
        </div>
      )}
    </div>
  );
}
