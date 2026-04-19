"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { LibraryEntry } from "@/types/api";

interface ArtistsListProps {
  artists: LibraryEntry[];
}

export function ArtistsList({ artists }: ArtistsListProps) {
  const [open, setOpen] = useState(false);

  if (artists.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 group cursor-pointer">
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <h3 className="text-sm font-medium text-muted-foreground">
          Artists ({artists.length})
        </h3>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
          {artists.map((a) => (
            <Link
              key={a.name}
              href={`/library/${encodeURIComponent(a.name)}`}
              className="rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors truncate"
            >
              {a.name}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
