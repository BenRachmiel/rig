"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSettingsStore, type Settings } from "@/stores/settings-store";
import { useNavStore } from "@/stores/nav-store";

const landingPages: { value: Settings["landingPage"]; label: string }[] = [
  { value: "/", label: "Home" },
  { value: "/download", label: "Download" },
  { value: "/library", label: "Library" },
  { value: "/reverb", label: "Reverb" },
  { value: "/credentials", label: "Keys" },
];

const themes: { value: Settings["theme"]; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`block size-3.5 rounded-full bg-background transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export function SettingsSheet() {
  const open = useNavStore((s) => s.settingsOpen);
  const close = useNavStore((s) => s.closeSettings);
  const settings = useSettingsStore();
  const set = settings.set;

  const [cacheSize, setCacheSize] = useState<number | null>(null);

  const refreshCacheSize = useCallback(async () => {
    if (!("caches" in window)) return;
    try {
      const cache = await caches.open("reverb-audio-v1");
      const keys = await cache.keys();
      let total = 0;
      for (const req of keys) {
        const res = await cache.match(req);
        if (res) {
          const buf = await res.clone().arrayBuffer();
          total += buf.byteLength;
        }
      }
      setCacheSize(total);
    } catch {
      setCacheSize(null);
    }
  }, []);

  useEffect(() => {
    if (open) refreshCacheSize();
  }, [open, refreshCacheSize]);

  const clearCache = useCallback(async () => {
    if (!("caches" in window)) return;
    await caches.delete("reverb-audio-v1");
    setCacheSize(0);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side="bottom" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4" />
            Settings
          </SheetTitle>
          <SheetDescription>Configure Rig preferences</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* General */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              General
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Landing page</span>
                <ToggleGroup
                  options={landingPages}
                  value={settings.landingPage}
                  onChange={(v) => set("landingPage", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <ToggleGroup
                  options={themes}
                  value={settings.theme}
                  onChange={(v) => set("theme", v)}
                />
              </div>
            </div>
          </section>

          {/* Playback */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Playback
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm">Volume normalization</span>
              <Toggle
                checked={settings.normalizationEnabled}
                onChange={(v) => set("normalizationEnabled", v)}
              />
            </div>
          </section>

          {/* Storage */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Storage
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Offline audio cache</span>
                <Toggle
                  checked={settings.offlineCacheEnabled}
                  onChange={(v) => set("offlineCacheEnabled", v)}
                />
              </div>
              {settings.offlineCacheEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Max size
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={50}
                        max={2000}
                        step={50}
                        value={settings.offlineCacheMaxMB}
                        onChange={(e) =>
                          set("offlineCacheMaxMB", Number(e.target.value))
                        }
                        className="w-24 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">
                        {settings.offlineCacheMaxMB} MB
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Used: {cacheSize !== null ? formatBytes(cacheSize) : "--"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCache}
                      className="text-destructive h-7 px-2"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
