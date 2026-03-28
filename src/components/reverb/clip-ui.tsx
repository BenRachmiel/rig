"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, ChevronUp, SkipBack, SkipForward } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { Oscilloscope } from "./waveform";
import { CLIP_DURATION } from "@/app/reverb/reducer";

interface ClipUIProps {
  isPlaying: boolean;
  progress: number;
  onSkip: () => void;
  onBack: () => void;
  onCommit: () => void;
  onPauseToggle: () => void;
  analyserNode: AnalyserNode | null;
  clipGeneration?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClipUI({
  isPlaying,
  progress,
  onSkip,
  onBack,
  onCommit,
  onPauseToggle,
  analyserNode,
  clipGeneration,
}: ClipUIProps) {
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
    onSwipedLeft: () => { flashEdge("right"); onSkip(); },
    onSwipedRight: () => { flashEdge("left"); onBack(); },
    onSwipedUp: onCommit,
    preventScrollOnSwipe: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); flashEdge("left"); onBack(); break;
        case "ArrowRight": e.preventDefault(); flashEdge("right"); onSkip(); break;
        case "ArrowUp": e.preventDefault(); onCommit(); break;
        case " ": e.preventDefault(); onPauseToggle(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSkip, onBack, onCommit, onPauseToggle, flashEdge]);

  const elapsed = progress * CLIP_DURATION;

  return (
    <div {...swipeHandlers} className="relative flex flex-col items-center w-full">
      {/* Edge flash */}
      {edgeFlash === "left" && (
        <div className="absolute left-0 top-0 w-1 h-full bg-white/10 animate-in fade-in duration-100" />
      )}
      {edgeFlash === "right" && (
        <div className="absolute right-0 top-0 w-1 h-full bg-white/10 animate-in fade-in duration-100" />
      )}

      {/* Desktop ghost buttons */}
      <button
        onClick={onBack}
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-20 transition-opacity"
      >
        <SkipBack className="size-4" />
      </button>
      <button
        onClick={onSkip}
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-20 transition-opacity"
      >
        <SkipForward className="size-4" />
      </button>

      {/* Oscilloscope — takes 2/3 of the height */}
      <div className="w-full h-[50dvh] shrink-0">
        <Oscilloscope analyserNode={analyserNode} isPlaying={isPlaying} generation={clipGeneration} />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6 pt-6 shrink-0">
        <span className="text-xs tabular-nums tracking-wider opacity-30">
          {formatTime(elapsed)} / {formatTime(CLIP_DURATION)}
        </span>

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

        <div className="flex flex-col items-center gap-1">
          <ChevronUp className="size-4 opacity-20" />
          <span className="text-[10px] tracking-[0.2em] uppercase opacity-20">swipe up</span>
        </div>
      </div>
    </div>
  );
}
