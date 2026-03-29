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
  const lastSongRef = useRef<string>("");

  useEffect(() => {
    if (songId === lastSongRef.current) return;
    lastSongRef.current = songId;
    setLyrics(null);
    setLoading(true);

    reverbApi
      .getLyrics(songId)
      .then((all) => {
        const synced = all.find((l) => l.synced);
        const unsynced = all.find((l) => !l.synced);
        setLyrics(synced ?? unsynced ?? null);
      })
      .catch(() => setLyrics(null))
      .finally(() => setLoading(false));
  }, [songId]);

  const currentMs = progress * duration * 1000;

  // Find active line index for synced lyrics
  let activeIndex = -1;
  if (lyrics?.synced) {
    for (let i = lyrics.line.length - 1; i >= 0; i--) {
      if (lyrics.line[i].start !== undefined && lyrics.line[i].start! <= currentMs) {
        activeIndex = i;
        break;
      }
    }
  }

  // Active line text (skip empty lines, show next non-empty)
  let activeLine = "";
  let nextLine = "";
  if (lyrics?.synced && activeIndex >= 0) {
    activeLine = lyrics.line[activeIndex].value.trim();
    // If current line is empty (instrumental break), skip it
    if (!activeLine) {
      for (let i = activeIndex - 1; i >= 0; i--) {
        const v = lyrics.line[i].value.trim();
        if (v) { activeLine = v; break; }
      }
    }
    // Find next non-empty line for preview
    for (let i = activeIndex + 1; i < lyrics.line.length; i++) {
      const v = lyrics.line[i].value.trim();
      if (v) { nextLine = v; break; }
    }
  }

  return (
    <div className="flex-1 min-h-0 px-2 py-4 flex flex-col items-center justify-center">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="size-1 rounded-full bg-white/20 animate-pulse" />
        </div>
      )}
      {!loading && lyrics && lyrics.line.length > 0 && (
        lyrics.synced ? (
          <div className="text-center space-y-3">
            <p
              key={activeIndex}
              className="text-sm text-white/90 animate-in fade-in duration-500"
            >
              {activeLine || "\u00A0"}
            </p>
            <p
              key={`next-${activeIndex}`}
              className="text-xs text-white/30 animate-in fade-in duration-500"
            >
              {nextLine || "\u00A0"}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-full space-y-3">
            {lyrics.line.map((line, i) => {
              if (!line.value.trim()) return <div key={i} className="h-4" />;
              return (
                <div key={i} className="text-sm text-center text-white/50">
                  {line.value}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
