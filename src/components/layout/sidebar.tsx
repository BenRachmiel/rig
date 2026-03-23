"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Library, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/download", label: "Download", icon: Download },
  { href: "/library", label: "Library", icon: Library },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-14 border-r border-border flex flex-col items-center py-4 gap-2 shrink-0">
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
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-4 h-4" />
          </Link>
        );
      })}
    </aside>
  );
}
