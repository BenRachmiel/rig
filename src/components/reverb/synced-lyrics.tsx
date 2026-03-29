"use client";

import { useEffect, useRef, useState } from "react";
import { reverbApi } from "@/lib/reverb-api";
import type { StructuredLyric } from "@/types/api";

interface SyncedLyricsProps {
  songId: string;
  progress: number;
  duration: number;
}

export function SyncedLyrics({ songId, progress, duration }: SyncedLyricsProps) {
  const [lyrics, setLyrics] = useState<StructuredLyric | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const lastSongRef = useRef<string>("");

  useEffect(() => {
    if (songId === lastSongRef.current) return;
    lastSongRef.current = songId;
    setLyrics(null);
    setLoading(true);

    reverbApi
      .getLyrics(songId)
      .then((all) => {
        // Prefer synced lyrics
        const synced = all.find((l) => l.synced);
        const unsynced = all.find((l) => !l.synced);
        setLyrics(synced ?? unsynced ?? null);
      })
      .catch(() => setLyrics(null))
      .finally(() => setLoading(false));
  }, [songId]);

  // Auto-scroll to active line
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    activeRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="size-1 rounded-full bg-white/20 animate-pulse" />
      </div>
    );
  }

  if (!lyrics || lyrics.line.length === 0) return null;

  const currentMs = progress * duration * 1000;

  // Find active line index for synced lyrics
  let activeIndex = -1;
  if (lyrics.synced) {
    for (let i = lyrics.line.length - 1; i >= 0; i--) {
      if (lyrics.line[i].start !== undefined && lyrics.line[i].start! <= currentMs) {
        activeIndex = i;
        break;
      }
    }
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0 px-2 py-4 space-y-3">
      {lyrics.line.map((line, i) => {
        if (!line.value.trim()) return <div key={i} className="h-4" />;
        const isActive = lyrics.synced ? i === activeIndex : false;
        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            className={`text-sm text-center transition-all duration-300 ${
              isActive
                ? "text-white/90 scale-[1.02]"
                : lyrics.synced
                  ? "text-white/30"
                  : "text-white/50"
            }`}
          >
            {line.value}
          </div>
        );
      })}
    </div>
  );
}
