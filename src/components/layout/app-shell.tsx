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

    const setThemeColor = (color: string) => {
      // Update all existing theme-color meta tags
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      if (metas.length > 0) {
        metas.forEach((m) => {
          m.removeAttribute("media");
          m.setAttribute("content", color);
        });
      } else {
        const m = document.createElement("meta");
        m.name = "theme-color";
        m.content = color;
        document.head.appendChild(m);
      }
    };

    const apply = (dark: boolean) => {
      html.classList.toggle("dark", dark);
      setThemeColor(dark ? "#000000" : "#ffffff");
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
