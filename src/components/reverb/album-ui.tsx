"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, ChevronUp, ChevronDown } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { Oscilloscope } from "./waveform";
import { SyncedLyrics } from "./synced-lyrics";
import { StarRating } from "./star-rating";
import { formatTime } from "@/lib/utils";
import { reverbApi } from "@/lib/reverb-api";
import { useNavStore } from "@/stores/nav-store";
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
  onAbandon?: () => void;
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
  onAbandon,
  analyserNode,
}: AlbumUIProps) {
  const [edgeFlash, setEdgeFlash] = useState<"left" | "right" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [starredSet, setStarredSet] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Map<string, number>>(new Map());
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abandonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashEdge = useCallback((side: "left" | "right") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setEdgeFlash(side);
    flashTimer.current = setTimeout(() => setEdgeFlash(null), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (abandonTimer.current) clearTimeout(abandonTimer.current);
    };
  }, []);

  // Sync expanded state to mobile nav
  useEffect(() => {
    if (expanded) useNavStore.getState().showMobileNav();
    else useNavStore.getState().hideMobileNav();
  }, [expanded]);

  // Load starred status for album songs
  useEffect(() => {
    reverbApi.getStarred().then((songs) => {
      const albumSongIds = new Set(album.song.map((s) => s.id));
      const starred = new Set(songs.filter((s) => albumSongIds.has(s.id)).map((s) => s.id));
      setStarredSet(starred);
    }).catch(() => {});
  }, [album]);

  // Initialize ratings from song data
  useEffect(() => {
    const r = new Map<string, number>();
    for (const song of album.song) {
      if (song.userRating) r.set(song.id, song.userRating);
    }
    setRatings(r);
  }, [album]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => { flashEdge("right"); onNextTrack(); },
    onSwipedRight: () => { flashEdge("left"); onPrevTrack(); },
    onSwipedUp: () => setExpanded(true),
    onSwipedDown: () => setExpanded(false),
    preventScrollOnSwipe: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); flashEdge("left"); onPrevTrack(); break;
        case "ArrowRight": e.preventDefault(); flashEdge("right"); onNextTrack(); break;
        case "ArrowUp": e.preventDefault(); setExpanded(true); break;
        case "ArrowDown": e.preventDefault(); setExpanded(false); break;
        case " ": e.preventDefault(); onPauseToggle(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNextTrack, onPrevTrack, onPauseToggle, flashEdge]);

  const currentSong = album.song[currentTrackIndex];
  const songId = currentSong?.id;
  const isStarred = songId ? starredSet.has(songId) : false;
  const currentRating = songId ? (ratings.get(songId) ?? 0) : 0;

  const handleToggleStar = useCallback(() => {
    if (!songId) return;
    const wasStarred = starredSet.has(songId);
    // Optimistic update
    setStarredSet((prev) => {
      const next = new Set(prev);
      if (wasStarred) next.delete(songId);
      else next.add(songId);
      return next;
    });
    const api = wasStarred ? reverbApi.unstar : reverbApi.star;
    api(songId).catch(() => {
      // Revert on error
      setStarredSet((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.add(songId);
        else next.delete(songId);
        return next;
      });
    });
  }, [songId, starredSet]);

  const handleSetRating = useCallback(
    (rating: number) => {
      if (!songId) return;
      const prevRating = ratings.get(songId) ?? 0;
      setRatings((prev) => new Map(prev).set(songId, rating));
      reverbApi.setRating(songId, rating).catch(() => {
        setRatings((prev) => new Map(prev).set(songId, prevRating));
      });
    },
    [songId, ratings],
  );

  const handleAbandon = useCallback(() => {
    if (!onAbandon) return;
    if (!abandonConfirm) {
      setAbandonConfirm(true);
      abandonTimer.current = setTimeout(() => setAbandonConfirm(false), 3000);
      return;
    }
    if (abandonTimer.current) clearTimeout(abandonTimer.current);
    setAbandonConfirm(false);
    onAbandon();
  }, [onAbandon, abandonConfirm]);

  return (
    <div {...swipeHandlers} className="relative flex flex-col items-center justify-center w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
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

      {/* Back to rediscover (visible when expanded) */}
      {expanded && onAbandon && (
        <button
          onClick={handleAbandon}
          className="absolute top-2 left-2 z-20 text-[10px] tracking-wider uppercase opacity-30 hover:opacity-60 transition-opacity flex items-center gap-1"
        >
          {abandonConfirm ? "tap again to confirm" : "back to rediscover"}
        </button>
      )}

      {/* Oscilloscope — transitions between heights */}
      <div
        className="w-full shrink-0 transition-[height] duration-300 ease-in-out"
        style={{ height: expanded ? "25dvh" : "50dvh" }}
      >
        <Oscilloscope
          analyserNode={analyserNode}
          isPlaying={isPlaying}
          generation={currentTrackIndex}
          active={!expanded}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 pt-3 shrink-0">
        <div className="text-center space-y-1">
          <span className="text-[10px] tabular-nums tracking-wider opacity-40">
            {currentTrackIndex + 1} / {album.songCount}
          </span>
          {currentSong && (
            <p className="text-sm opacity-80">{currentSong.title}</p>
          )}
        </div>

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
          className="size-14 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: "1px solid oklch(1 0 0 / calc(0.1 + var(--rv-peak) * 0.15))",
          }}
        >
          {isPlaying ? (
            <Pause className="size-5" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          ) : (
            <Play className="size-5 ml-0.5" style={{ opacity: "calc(0.6 + var(--rv-energy) * 0.4)" }} />
          )}
        </button>

        {/* Favorite + Rating (visible when expanded) */}
        <div
          className={`flex items-center gap-6 transition-all duration-300 overflow-hidden ${
            expanded ? "opacity-100 h-auto pt-2" : "opacity-0 h-0"
          }`}
        >
          <button
            onClick={handleToggleStar}
            className="p-1 transition-colors"
          >
            <Heart
              className={`size-5 ${
                isStarred ? "fill-white/80 text-white/80" : "text-white/30"
              }`}
            />
          </button>
          <StarRating rating={currentRating} onChange={handleSetRating} />
        </div>
      </div>

      {/* Drawer expand/collapse hint */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="py-2 opacity-20 hover:opacity-40 transition-opacity"
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {/* Lyrics (always rendered when expanded for stable layout) */}
      {expanded && (
        <div className="w-full max-h-[40dvh] overflow-y-auto animate-in fade-in duration-300">
          {songId && (
            <SyncedLyrics
              songId={songId}
              progress={progress}
              duration={currentSong?.duration ?? 0}
            />
          )}
        </div>
      )}
    </div>
  );
}
