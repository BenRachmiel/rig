"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PlaybackProvider } from "@/contexts/playback-context";
import { MiniPlayer } from "@/components/playback/mini-player";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <PlaybackProvider>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <MiniPlayer />
      <Toaster />
    </PlaybackProvider>
  );
}
