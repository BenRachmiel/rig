"use client";

import { Settings as SettingsIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useSettingsStore, type Settings } from "@/stores/settings-store";
import { useNavStore } from "@/stores/nav-store";

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
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <ToggleGroup
                options={themes}
                value={settings.theme}
                onChange={(v) => set("theme", v)}
              />
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
