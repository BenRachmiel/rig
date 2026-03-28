"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Library, Headphones, KeyRound, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

const nav = [
  { href: "/download", label: "Download", icon: Download },
  { href: "/library", label: "Library", icon: Library },
  { href: "/reverb", label: "Reverb", icon: Headphones },
  { href: "/credentials", label: "Keys", icon: KeyRound },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 860px)");
  const [revealed, setRevealed] = useState(false);

  if (isMobile) {
    return (
      <>
        {/* Pull tab — when nav is hidden */}
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="fixed bottom-0 left-0 right-0 z-30 h-6 flex items-center justify-center"
          >
            <ChevronUp className="size-3 opacity-15" />
          </button>
        )}
        {/* Dismiss overlay — tap anywhere above nav to hide */}
        {revealed && (
          <button
            onClick={() => setRevealed(false)}
            className="fixed inset-0 z-20"
            aria-label="Hide navigation"
          />
        )}
        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-border bg-background flex items-center justify-around px-2 transition-transform duration-200",
            !revealed && "translate-y-full",
          )}
        >
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setRevealed(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[48px] h-11 rounded-md transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <aside className="w-14 border-r border-border bg-background flex flex-col items-center py-4 gap-2 shrink-0">
      <Link
        href="/"
        className="text-sm font-bold tracking-tight mb-4 text-foreground"
      >
        R
      </Link>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "w-9 h-9 rounded-md flex items-center justify-center transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <Icon className="w-4 h-4" />
          </Link>
        );
      })}
    </aside>
  );
}
