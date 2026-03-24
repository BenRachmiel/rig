"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/library/stat-card";
import { IssueTable } from "@/components/library/issue-table";
import { preampApi } from "@/lib/preamp-api";
import * as libraryApi from "@/lib/library-api";
import type { Stats, ScanStatus, IssuesResponse, LibraryEntry } from "@/types/api";

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

export default function LibraryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scan, setScan] = useState<ScanStatus>({ scanning: false, count: 0 });
  const [activeIssue, setActiveIssue] = useState<IssueKey | null>(null);
  const [issueData, setIssueData] = useState<IssuesResponse | null>(null);
  const [issueOffset, setIssueOffset] = useState(0);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [artists, setArtists] = useState<LibraryEntry[]>([]);

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
        preampApi.stats().then(setStats);
        if (activeIssue) {
          fetchIssues(activeIssue, 0);
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [scan.scanning, activeIssue]);

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

  const handleSaved = () => {
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Library Maintenance
        </h1>
        <p className="text-sm text-muted-foreground">
          Data quality issues and scanning
        </p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Artists" value={stats.artists} />
            <StatCard label="Albums" value={stats.albums} />
            <StatCard label="Songs" value={stats.songs} />
          </div>

          {artists.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Artists
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
            </div>
          )}

          {issues.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Data Quality
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {issues.map((i) => (
                  <StatCard
                    key={i.key}
                    label={i.label}
                    value={i.count}
                    variant="warning"
                    active={activeIssue === i.key}
                    onClick={() => handleIssueClick(i.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
          />
        </div>
      )}

      {activeIssue && loadingIssue && !issueData && (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Scan control */}
      <div className="flex flex-col gap-4 rounded-lg border p-6 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Library Scan</h3>
            <p className="text-sm text-muted-foreground">
              {scan.scanning
                ? `Scanning... ${scan.count} tracks found`
                : `${scan.count} tracks indexed`}
            </p>
          </div>
          <Button onClick={handleScan} disabled={scan.scanning}>
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${scan.scanning ? "animate-spin" : ""}`}
            />
            {scan.scanning ? "Scanning..." : "Rescan"}
          </Button>
        </div>
        {scan.scanning && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
          </div>
        )}
      </div>
    </div>
  );
}
