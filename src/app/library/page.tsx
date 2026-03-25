"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { RefreshCw, ChevronRight, Wallpaper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { StatCard } from "@/components/library/stat-card";
import { IssueTable } from "@/components/library/issue-table";
import { IssueWizard } from "@/components/library/issue-wizard";
import { preampApi } from "@/lib/preamp-api";
import * as libraryApi from "@/lib/library-api";
import type {
  Stats,
  ScanStatus,
  IssuesResponse,
  LibraryEntry,
} from "@/types/api";

type IssueKey =
  | "albums_missing_art"
  | "albums_no_year"
  | "albums_no_genre"
  | "songs_unknown_artist"
  | "songs_no_genre"
  | "songs_no_year"
  | "songs_zero_duration";

const ISSUE_LABELS: Record<IssueKey, string> = {
  albums_missing_art: "Albums missing cover art",
  albums_no_year: "Albums missing year",
  albums_no_genre: "Albums missing genre",
  songs_unknown_artist: "Songs by Unknown Artist",
  songs_no_genre: "Songs missing genre",
  songs_no_year: "Songs missing year",
  songs_zero_duration: "Songs with zero duration",
};

const BG_STORAGE_KEY = "library-bg-enabled";

function useLocalStorageToggle(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const initialized = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) setValue(stored === "true");
    initialized.current = true;
  }, [key]);

  const toggle = useCallback(() => {
    setValue((prev) => {
      const next = !prev;
      localStorage.setItem(key, String(next));
      return next;
    });
  }, [key]);

  return [value, toggle, initialized.current] as const;
}

export default function LibraryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scan, setScan] = useState<ScanStatus>({ scanning: false, count: 0 });
  const [activeIssue, setActiveIssue] = useState<IssueKey | null>(null);
  const [issueData, setIssueData] = useState<IssuesResponse | null>(null);
  const [issueOffset, setIssueOffset] = useState(0);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [artists, setArtists] = useState<LibraryEntry[]>([]);
  const [coverUrls, setCoverUrls] = useState<string[]>([]);
  const [bgEnabled, toggleBg] = useLocalStorageToggle(BG_STORAGE_KEY, true);
  const [wizardIssue, setWizardIssue] = useState<IssueKey | null>(null);
  const [artistsOpen, setArtistsOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    const [s, sc, browse] = await Promise.all([
      preampApi.stats(),
      libraryApi.scanStatus(),
      libraryApi.browse(""),
    ]);
    setStats(s);
    setScan(sc);
    setArtists(browse.entries.filter((e) => e.type === "directory"));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Poll while scanning
  useEffect(() => {
    if (!scan.scanning) return;
    const id = setInterval(async () => {
      const s = await libraryApi.scanStatus();
      setScan(s);
      if (!s.scanning) {
        clearInterval(id);
        toast.success(`Scan complete — ${s.count} tracks indexed`);
        preampApi.stats().then(setStats);
        if (activeIssue) {
          fetchIssues(activeIssue, 0);
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [scan.scanning, activeIssue]);

  // Stream album art background wall — push URLs one at a time for smooth fade-in
  useEffect(() => {
    if (artists.length === 0) return;
    let cancelled = false;

    async function loadCovers() {
      const shuffled = [...artists]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      let count = 0;

      for (const artist of shuffled) {
        if (cancelled || count >= 24) return;
        try {
          const { entries } = await libraryApi.browse(artist.name);
          const albums = entries.filter((e) => e.type === "directory");
          for (const album of albums.slice(0, 3)) {
            if (cancelled || count >= 24) return;
            const url = libraryApi.coverDirUrl(album.path);
            setCoverUrls((prev) => [...prev, url]);
            count++;
          }
        } catch {
          // skip artist on error
        }
      }
    }

    loadCovers();
    return () => {
      cancelled = true;
    };
  }, [artists]);

  const fetchIssues = async (type: IssueKey, offset: number) => {
    setLoadingIssue(true);
    try {
      const data = await preampApi.issues(type, 50, offset);
      if (offset > 0 && issueData) {
        setIssueData({
          items: [...issueData.items, ...data.items] as typeof data.items,
          total: data.total,
        });
      } else {
        setIssueData(data);
      }
      setIssueOffset(offset);
    } finally {
      setLoadingIssue(false);
    }
  };

  const handleIssueClick = (key: IssueKey) => {
    if (activeIssue === key) {
      setActiveIssue(null);
      setIssueData(null);
      setIssueOffset(0);
      return;
    }
    setActiveIssue(key);
    setIssueOffset(0);
    fetchIssues(key, 0);
  };

  const handleLoadMore = () => {
    if (!activeIssue || !issueData) return;
    fetchIssues(activeIssue, issueOffset + 50);
  };

  const handleSaved = async () => {
    // Backend writes trigger an async rescan — wait for it to finish before refreshing
    const waitForRescan = async () => {
      // Give the scan a moment to start
      await new Promise((r) => setTimeout(r, 500));
      for (let i = 0; i < 20; i++) {
        const s = await libraryApi.scanStatus();
        if (!s.scanning) return;
        await new Promise((r) => setTimeout(r, 500));
      }
    };
    await waitForRescan();
    if (activeIssue) {
      fetchIssues(activeIssue, 0);
    }
    preampApi.stats().then(setStats);
  };

  const handleScan = async () => {
    setScan(await libraryApi.startScan());
  };

  const issues: { key: IssueKey; label: string; count: number }[] = stats
    ? (Object.entries(ISSUE_LABELS) as [IssueKey, string][])
        .map(([key, label]) => ({
          key,
          label,
          count: stats[key],
        }))
        .filter((i) => i.count > 0)
    : [];

  const totalIssues = issues.reduce((sum, i) => sum + i.count, 0);

  // Build wall: duplicate URLs to fill columns, then duplicate the row block for seamless looping
  const COLS = 8;
  const ROWS = 5;
  const cellCount = COLS * ROWS;
  const wallUrls =
    coverUrls.length > 0
      ? Array.from(
          { length: cellCount },
          (_, i) => coverUrls[i % coverUrls.length],
        )
      : [];

  return (
    <>
      {/* Animated album art background wall */}
      {bgEnabled && wallUrls.length > 0 && (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-[0.12]">
          <div
            className="animate-wall-pan"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              width: "100%",
            }}
          >
            {/* Render two copies of the grid for seamless looping */}
            {[...wallUrls, ...wallUrls].map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                loading="lazy"
                className="w-full aspect-square object-cover opacity-0 transition-opacity duration-700"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).classList.remove("opacity-0");
                  (e.target as HTMLImageElement).classList.add("opacity-100");
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-6">
        {/* Header with rescan button and background toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Library Maintenance
            </h1>
            <p className="text-sm text-muted-foreground">
              {scan.scanning
                ? `Scanning... ${scan.count} tracks found`
                : "Data quality issues and scanning"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {coverUrls.length > 0 && (
              <Toggle
                pressed={bgEnabled}
                onPressedChange={toggleBg}
                variant="outline"
                size="sm"
                aria-label="Toggle background art"
              >
                <Wallpaper className="h-4 w-4" />
              </Toggle>
            )}
            <Button onClick={handleScan} disabled={scan.scanning}>
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${scan.scanning ? "animate-spin" : ""}`}
              />
              {scan.scanning ? "Scanning..." : "Rescan"}
            </Button>
          </div>
        </div>

        {/* Scanning progress bar */}
        {scan.scanning && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden -mt-4">
            <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Artists" value={stats.artists} />
              <StatCard label="Albums" value={stats.albums} />
              <StatCard label="Songs" value={stats.songs} />
            </div>

            {/* Collapsible Artists */}
            {artists.length > 0 && (
              <Collapsible open={artistsOpen} onOpenChange={setArtistsOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-1.5 group cursor-pointer">
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${artistsOpen ? "rotate-90" : ""}`}
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
            )}

            {/* Collapsible Data Quality */}
            <Collapsible open={qualityOpen} onOpenChange={setQualityOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 group cursor-pointer">
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${qualityOpen ? "rotate-90" : ""}`}
                />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Data Quality ({totalIssues} issue
                  {totalIssues !== 1 ? "s" : ""})
                </h3>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {issues.length > 0 ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex flex-col gap-1">
                      {issues.map((i) => (
                        <button
                          key={i.key}
                          type="button"
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors text-left ${
                            activeIssue === i.key
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleIssueClick(i.key)}
                        >
                          <span>{i.label}</span>
                          <span className="tabular-nums font-medium text-amber-500">
                            {i.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Active issue table */}
                    {activeIssue && issueData && !loadingIssue && (
                      <div className="rounded-lg border p-4 bg-card">
                        <h3 className="font-medium mb-3">
                          {ISSUE_LABELS[activeIssue]}
                        </h3>
                        <IssueTable
                          type={activeIssue}
                          items={issueData.items}
                          total={issueData.total}
                          onLoadMore={handleLoadMore}
                          onSaved={handleSaved}
                          onFixAll={() => setWizardIssue(activeIssue)}
                        />
                      </div>
                    )}

                    {activeIssue && loadingIssue && !issueData && (
                      <div className="flex justify-center py-8">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pt-2">
                    No data quality issues found
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>

      {wizardIssue && (
        <IssueWizard
          issueType={wizardIssue}
          open={!!wizardIssue}
          onOpenChange={(open) => {
            if (!open) setWizardIssue(null);
          }}
          onComplete={handleSaved}
          existingArtists={artists.map((a) => a.name)}
        />
      )}
    </>
  );
}
