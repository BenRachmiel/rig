"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, ChevronUp, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, AudioLines } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { Oscilloscope } from "./waveform";
import { CLIP_DURATION } from "@/app/reverb/reducer";
import { formatTime } from "@/lib/utils";

interface ClipUIProps {
  isPlaying: boolean;
  isBuffering?: boolean;
  isNormalizing?: boolean;
  progress: number;
  onSkip: () => void;
  onBack: () => void;
  onCommit: () => void;
  onPauseToggle: () => void;
  analyserNode: AnalyserNode | null;
  clipGeneration?: number;
  normalizationEnabled?: boolean;
  onNormalizationToggle?: () => void;
}

const DEBOUNCE_MS = 300;
const HINTS_SEEN_KEY = "rig:reverb-hints-seen";

function haptic() {
  navigator.vibrate?.(10);
}

export function ClipUI({
  isPlaying,
  isBuffering,
  isNormalizing,
  progress,
  onSkip,
  onBack,
  onCommit,
  onPauseToggle,
  analyserNode,
  clipGeneration,
  normalizationEnabled,
  onNormalizationToggle,
}: ClipUIProps) {
  const [skipFlash, setSkipFlash] = useState<"prev" | "next" | null>(null);
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

  const flashSkip = useCallback((dir: "prev" | "next") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setSkipFlash(dir);
    flashTimer.current = setTimeout(() => setSkipFlash(null), 400);
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
    flashSkip("next");
    haptic();
    onSkip();
  }, [tryNav, flashSkip, onSkip]);

  const handleBack = useCallback(() => {
    if (!tryNav()) return;
    flashSkip("prev");
    haptic();
    onBack();
  }, [tryNav, flashSkip, onBack]);

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
      {/* Skip direction indicator */}
      <div className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-opacity duration-500 ${skipFlash ? "opacity-100" : "opacity-0"}`}>
        {skipFlash === "prev" && <ChevronsLeft className="size-10 text-white/70" />}
        {skipFlash === "next" && <ChevronsRight className="size-10 text-white/70" />}
      </div>

      {/* First-visit gesture hints */}
      {showHints && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 animate-in fade-in duration-500"
          onClick={dismissHints}
        >
          <div className="text-center space-y-3 text-foreground/50 text-xs tracking-wider">
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
        <span className={`text-xs tabular-nums tracking-wider opacity-30${isBuffering || isNormalizing ? " animate-pulse" : ""}`}>
          {isBuffering ? "buffering" : isNormalizing ? "normalizing" : `${formatTime(elapsed)} / ${formatTime(CLIP_DURATION)}`}
        </span>

        <button
          onClick={onPauseToggle}
          className={`size-16 rounded-full flex items-center justify-center transition-colors${isBuffering || isNormalizing ? " animate-pulse" : ""}`}
          style={{
            border: isBuffering || isNormalizing
              ? "1px solid oklch(var(--rv-fg-oklch) / 0.3)"
              : "1px solid oklch(var(--rv-fg-oklch) / calc(0.1 + var(--rv-peak) * 0.15))",
          }}
        >
          {isPlaying ? (
            <Pause className="size-6" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          ) : (
            <Play className="size-6 ml-0.5" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          )}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <ChevronUp className="size-4 opacity-20" />
            <span className="text-[10px] tracking-[0.2em] uppercase opacity-20">swipe up</span>
          </div>
          {onNormalizationToggle && (
            <button
              onClick={onNormalizationToggle}
              className="p-1.5 transition-opacity"
              title={normalizationEnabled ? "Volume normalization on" : "Volume normalization off"}
            >
              <AudioLines className={`size-4 ${normalizationEnabled ? "opacity-60" : "opacity-20"}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
