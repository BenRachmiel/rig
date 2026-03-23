"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { resolveStreamUrl } from "@/lib/gain-api";
import type { ResolveMeta, Track } from "@/types/api";

export function useResolveStream() {
  const esRef = useRef<EventSource | null>(null);
  const resolvingAlbumId = useAppStore((s) => s.resolvingAlbumId);

  useEffect(() => {
    if (resolvingAlbumId === null) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    esRef.current?.close();

    const es = new EventSource(resolveStreamUrl(resolvingAlbumId));
    esRef.current = es;

    es.addEventListener("meta", (e: MessageEvent) => {
      const meta: ResolveMeta = JSON.parse(e.data);
      useAppStore.getState().setResolveMeta(meta);
    });

    es.addEventListener("track", (e: MessageEvent) => {
      const track: Track = JSON.parse(e.data);
      useAppStore.getState().addResolvedTrack(track);
    });

    es.addEventListener("done", () => {
      es.close();
      esRef.current = null;
      useAppStore.getState().finishResolve();
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;
      useAppStore.getState().cancelResolve();
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      useAppStore.getState().cancelResolve();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [resolvingAlbumId]);
}
