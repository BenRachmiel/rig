"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, ChevronUp, SkipBack, SkipForward } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { Oscilloscope } from "./waveform";
import { CLIP_DURATION } from "@/app/reverb/reducer";
import { formatTime } from "@/lib/utils";

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

const DEBOUNCE_MS = 300;
const HINTS_SEEN_KEY = "rig:reverb-hints-seen";

function haptic() {
  navigator.vibrate?.(10);
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
  const [scopeDip, setScopeDip] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNavRef = useRef(0);
  const hintsRef = useRef(false);

  // Show gesture hints on first visit
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(HINTS_SEEN_KEY)) {
      setShowHints(true);
      hintsRef.current = true;
    }
  }, []);

  const flashEdge = useCallback((side: "left" | "right") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setEdgeFlash(side);
    flashTimer.current = setTimeout(() => setEdgeFlash(null), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (dipTimer.current) clearTimeout(dipTimer.current);
    };
  }, []);

  // Stable identity — reads from ref to avoid cascade
  const dismissHints = useCallback(() => {
    if (hintsRef.current) {
      hintsRef.current = false;
      setShowHints(false);
      localStorage.setItem(HINTS_SEEN_KEY, "1");
    }
  }, []);

  /** Debounced navigation — returns false if within cooldown */
  const tryNav = useCallback(() => {
    const now = Date.now();
    if (now - lastNavRef.current < DEBOUNCE_MS) return false;
    lastNavRef.current = now;
    dismissHints();
    setScopeDip(true);
    if (dipTimer.current) clearTimeout(dipTimer.current);
    dipTimer.current = setTimeout(() => setScopeDip(false), 150);
    return true;
  }, [dismissHints]);

  const handleSkip = useCallback(() => {
    if (!tryNav()) return;
    flashEdge("right");
    haptic();
    onSkip();
  }, [tryNav, flashEdge, onSkip]);

  const handleBack = useCallback(() => {
    if (!tryNav()) return;
    flashEdge("left");
    haptic();
    onBack();
  }, [tryNav, flashEdge, onBack]);

  const handleCommit = useCallback(() => {
    if (!tryNav()) return;
    haptic();
    onCommit();
  }, [tryNav, onCommit]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleSkip,
    onSwipedRight: handleBack,
    onSwipedUp: handleCommit,
    preventScrollOnSwipe: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); handleBack(); break;
        case "ArrowRight": e.preventDefault(); handleSkip(); break;
        case "ArrowUp": e.preventDefault(); handleCommit(); break;
        case " ": e.preventDefault(); dismissHints(); onPauseToggle(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSkip, handleBack, handleCommit, onPauseToggle]);

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

      {/* First-visit gesture hints */}
      {showHints && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 animate-in fade-in duration-500"
          onClick={dismissHints}
        >
          <div className="text-center space-y-3 text-white/50 text-xs tracking-wider">
            <p><kbd className="opacity-70">arrow</kbd> / <span className="opacity-70">swipe</span> to skip</p>
            <p><kbd className="opacity-70">up</kbd> / <span className="opacity-70">swipe up</span> to commit</p>
            <p><kbd className="opacity-70">space</kbd> to pause</p>
            <p className="pt-2 text-[10px] opacity-30">tap to dismiss</p>
          </div>
        </div>
      )}

      {/* Desktop ghost buttons */}
      <button
        onClick={handleBack}
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-35 transition-opacity"
      >
        <SkipBack className="size-4" />
      </button>
      <button
        onClick={handleSkip}
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-0 hover:opacity-35 transition-opacity"
      >
        <SkipForward className="size-4" />
      </button>

      {/* Oscilloscope — brief opacity dip on clip transition */}
      <div
        className="w-full h-[50dvh] shrink-0 transition-opacity duration-150"
        style={{ opacity: scopeDip ? 0.4 : 1 }}
      >
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
