"use client";

import { reverbApi } from "@/lib/reverb-api";
import type { AlbumWithSongsID3 } from "@/types/api";

interface RevealUIProps {
  album: AlbumWithSongsID3;
  onRestart: () => void;
}

export function RevealUI({ album, onRestart }: RevealUIProps) {
  const meta = [
    album.year > 0 ? String(album.year) : null,
    album.genre || null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col items-center w-full gap-5 justify-center">
      {/* Album art with blur-in reveal and reactive glow */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={reverbApi.coverArtUrl(album.coverArt, 512)}
        alt={`${album.name} cover`}
        className="w-48 h-48 sm:w-56 sm:h-56 rounded-md object-cover"
        style={{
          animation: "rv-reveal 1200ms ease-out forwards",
          boxShadow: "0 0 calc(var(--rv-energy) * 80px) calc(var(--rv-energy) * 20px) oklch(1 0 0 / calc(var(--rv-energy) * 0.08))",
        }}
      />

      {/* Album name — delayed fade in */}
      <h2
        className="text-lg font-light tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-forwards"
        style={{ animationDelay: "400ms", opacity: 0 }}
      >
        {album.name}
      </h2>

      {/* Artist */}
      <p
        className="text-xs tracking-[0.15em] uppercase animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-forwards"
        style={{ animationDelay: "600ms", opacity: 0 }}
      >
        <span className="opacity-60">{album.artist}</span>
      </p>

      {/* Year · Genre */}
      {meta && (
        <p
          className="text-[10px] tracking-[0.2em] uppercase animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-forwards"
          style={{ animationDelay: "800ms", opacity: 0 }}
        >
          <span className="opacity-30">{meta}</span>
        </p>
      )}

      {/* Continue */}
      <button
        onClick={onRestart}
        className="text-xs tracking-wider animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-forwards hover:opacity-60 transition-opacity"
        style={{ animationDelay: "1200ms", opacity: 0 }}
      >
        continue
      </button>
    </div>
  );
}
