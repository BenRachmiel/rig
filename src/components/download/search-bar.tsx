"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import type { Source } from "@/types/api";

const SOURCES: { value: Source; label: string }[] = [
  { value: "tidal", label: "Tidal" },
  { value: "youtube", label: "YouTube" },
];

export function SearchBar() {
  const [query, setQuery] = useState("");
  const searchLoading = useAppStore((s) => s.searchLoading);
  const search = useAppStore((s) => s.search);
  const source = useAppStore((s) => s.source);
  const setSource = useAppStore((s) => s.setSource);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    search(q);
  };

  return (
    <div className="flex gap-2">
      <div className="flex rounded-md border border-input bg-muted/30 p-0.5 shrink-0">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              source === s.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        placeholder={source === "youtube" ? "Search YouTube..." : "Search albums..."}
        className="flex-1"
      />
      <Button onClick={handleSearch} disabled={searchLoading} size="icon" className="shrink-0 md:w-auto md:px-4">
        <Search className="h-4 w-4 md:mr-1.5" />
        <span className="hidden md:inline">Search</span>
      </Button>
    </div>
  );
}
