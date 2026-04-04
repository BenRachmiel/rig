"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PlaybackProvider } from "@/contexts/playback-context";
import { MiniPlayer } from "@/components/playback/mini-player";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import { useSettingsStore } from "@/stores/settings-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  // Theme application
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    const html = document.documentElement;
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    const color = (dark: boolean) => dark ? "#000000" : "#ffffff";

    const apply = (dark: boolean) => {
      html.classList.toggle("dark", dark);
      // Override all theme-color meta tags (Next.js renders one per media query)
      metas.forEach((m) => m.setAttribute("content", color(dark)));
    };

    if (theme === "dark") {
      apply(true);
    } else if (theme === "light") {
      apply(false);
    } else {
      // system
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return (
    <PlaybackProvider>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <MiniPlayer />
      <SettingsSheet />
      <Toaster />
    </PlaybackProvider>
  );
}
