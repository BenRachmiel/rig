"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Library, Headphones, KeyRound } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";

const cards = [
  { href: "/download", label: "Download", icon: Download },
  { href: "/library", label: "Library", icon: Library },
  { href: "/reverb", label: "Reverb", icon: Headphones },
  { href: "/credentials", label: "Keys", icon: KeyRound },
] as const;

export default function Home() {
  const router = useRouter();
  const landingPage = useSettingsStore((s) => s.landingPage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Single tick delay — persist rehydrates synchronously from localStorage
    // but the store selector returns the default on the first render.
    // By the next tick the persisted value is in place.
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (ready && landingPage !== "/") router.replace(landingPage);
  }, [ready, router, landingPage]);

  if (!ready || landingPage !== "/") return null;

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-bold tracking-tight">R</span>
        <span className="text-sm text-muted-foreground">Rig</span>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-xs w-full">
        {cards.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-2 rounded-lg bg-card border border-border p-6 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-6" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
