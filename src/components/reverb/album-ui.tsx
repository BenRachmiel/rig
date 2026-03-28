"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { Oscilloscope } from "./waveform";
import { formatTime } from "@/lib/utils";
import type { AlbumWithSongsID3 } from "@/types/api";

interface AlbumUIProps {
  album: AlbumWithSongsID3;
  currentTrackIndex: number;
  progress: number;
  isPlaying: boolean;
  onPauseToggle: () => void;
  onTrackSelect: (index: number) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  analyserNode: AnalyserNode | null;
}

export function AlbumUI({
  album,
  currentTrackIndex,
  progress,
  isPlaying,
  onPauseToggle,
  onNextTrack,
  onPrevTrack,
  analyserNode,
}: AlbumUIProps) {
  const [edgeFlash, setEdgeFlash] = useState<"left" | "right" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashEdge = useCallback((side: "left" | "right") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setEdgeFlash(side);
    flashTimer.current = setTimeout(() => setEdgeFlash(null), 200);
  }, []);

  useEffect(() => {
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => { flashEdge("right"); onNextTrack(); },
    onSwipedRight: () => { flashEdge("left"); onPrevTrack(); },
    preventScrollOnSwipe: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); flashEdge("left"); onPrevTrack(); break;
        case "ArrowRight": e.preventDefault(); flashEdge("right"); onNextTrack(); break;
        case " ": e.preventDefault(); onPauseToggle(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNextTrack, onPrevTrack, onPauseToggle, flashEdge]);

  const currentSong = album.song[currentTrackIndex];

  return (
    <div {...swipeHandlers} className="relative flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Edge flash */}
      {edgeFlash === "left" && (
        <div className="absolute left-0 top-0 w-1 h-full bg-white/10 animate-in fade-in duration-100 z-20" />
      )}
      {edgeFlash === "right" && (
        <div className="absolute right-0 top-0 w-1 h-full bg-white/10 animate-in fade-in duration-100 z-20" />
      )}

      {/* Desktop ghost buttons */}
      <button
        onClick={onPrevTrack}
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-20 transition-opacity z-10"
      >
        <SkipBack className="size-4" />
      </button>
      <button
        onClick={onNextTrack}
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-20 transition-opacity z-10"
      >
        <SkipForward className="size-4" />
      </button>

      {/* Oscilloscope — takes 2/3 of the height */}
      <div className="w-full h-[50dvh] shrink-0">
        <Oscilloscope analyserNode={analyserNode} isPlaying={isPlaying} generation={currentTrackIndex} />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6 pt-6 shrink-0">
        <div className="text-center space-y-1">
          <span className="text-[10px] tabular-nums tracking-wider opacity-40">
            {currentTrackIndex + 1} / {album.songCount}
          </span>
          {currentSong && (
            <p className="text-sm opacity-80">{currentSong.title}</p>
          )}
        </div>

        {/* Timer */}
        {currentSong && (
          <span className="text-xs tabular-nums tracking-wider opacity-30">
            {formatTime(progress * currentSong.duration)} / {formatTime(currentSong.duration)}
          </span>
        )}

        <p className="text-xs tracking-wider opacity-40 text-center">
          {album.artist} — {album.name}
        </p>

        <button
          onClick={onPauseToggle}
          className="size-16 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: "1px solid oklch(1 0 0 / calc(0.1 + var(--rv-peak) * 0.15))",
          }}
        >
          {isPlaying ? (
            <Pause className="size-6" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          ) : (
            <Play className="size-6 ml-0.5" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          )}
        </button>
      </div>

    </div>
  );
}
