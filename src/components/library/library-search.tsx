"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X, Music, Disc3, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as libraryApi from "@/lib/library-api";
import type { SearchResult } from "@/lib/library-api";

export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await libraryApi.searchLibrary(query.trim()));
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const hasResults =
    results &&
    (results.artists.length > 0 ||
      results.albums.length > 0 ||
      results.songs.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search library..."
          className="pl-8 pr-8 h-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={() => setQuery("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {query.trim() && searching && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Searching...
        </p>
      )}

      {query.trim() && !searching && results && !hasResults && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No results
        </p>
      )}

      {hasResults && (
        <div className="flex flex-col gap-4">
          {results.artists.length > 0 && (
            <ResultSection icon={User} title="Artists">
              {results.artists.map((a) => (
                <Link
                  key={a.id}
                  href={`/library/${encodeURIComponent(a.name)}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                >
                  <span className="text-sm truncate">{a.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {a.albumCount} album{a.albumCount !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </ResultSection>
          )}

          {results.albums.length > 0 && (
            <ResultSection icon={Disc3} title="Albums">
              {results.albums.map((a) => (
                <Link
                  key={a.id}
                  href={`/library/${encodeURIComponent(a.artist)}/${encodeURIComponent(a.name)}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {a.artist}
                      {a.year ? ` \u00b7 ${a.year}` : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {results.songs.length > 0 && (
            <ResultSection icon={Music} title="Songs">
              {results.songs.map((s) => (
                <Link
                  key={s.id}
                  href={`/library/${encodeURIComponent(s.artist)}/${encodeURIComponent(s.album)}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{s.title}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {s.artist} \u00b7 {s.album}
                    </span>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}
