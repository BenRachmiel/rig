"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Pause, X } from "lucide-react";
import { usePlaybackStore } from "@/stores/playback-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MiniOscilloscope } from "./mini-oscilloscope";

export function MiniPlayer() {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 860px)");
  const track = usePlaybackStore((s) => s.track);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const progress = usePlaybackStore((s) => s.progress);
  const visible = usePlaybackStore((s) => s.miniPlayerVisible);
  const analyserNode = usePlaybackStore((s) => s.analyserNode);

  if (pathname.startsWith("/reverb") || !visible || !track) return null;

  const handlePlayPause = () => {
    const { controls } = usePlaybackStore.getState();
    if (isPlaying) controls.pause();
    else controls.resume();
  };

  const handleClose = () => {
    const { controls } = usePlaybackStore.getState();
    controls.stop();
    usePlaybackStore.getState().clearPlayback();
  };

  return (
    <div
      className={
        isMobile
          ? "fixed bottom-0 left-0 right-0 z-35 border-t border-border bg-card"
          : "fixed bottom-6 right-6 z-35 w-80 rounded-lg border border-border bg-card shadow-2xl"
      }
    >
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-white/30 transition-[width] duration-300 ease-linear"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>

      <div className="flex items-center gap-3 p-3">
        <Link href="/reverb" className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-10 rounded shrink-0 overflow-hidden bg-black">
            <MiniOscilloscope analyserNode={analyserNode} isPlaying={isPlaying} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handlePlayPause}
            className="size-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>
          <button
            onClick={handleClose}
            className="size-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
