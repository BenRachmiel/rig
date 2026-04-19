"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/library/stat-card";
import { ArtistsList } from "@/components/library/artists-list";
import { IssuePanel } from "@/components/library/issue-panel";
import { preampApi } from "@/lib/preamp-api";
import * as libraryApi from "@/lib/library-api";
import type { Stats, ScanStatus, LibraryEntry } from "@/types/api";

export default function LibraryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scan, setScan] = useState<ScanStatus>({ scanning: false, count: 0 });
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

  useEffect(() => {
    if (!scan.scanning) return;
    const id = setInterval(async () => {
      const s = await libraryApi.scanStatus();
      setScan(s);
      if (!s.scanning) {
        clearInterval(id);
        toast.success(`Scan complete — ${s.count} tracks indexed`);
        preampApi.stats().then(setStats);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [scan.scanning]);

  const handleScan = async () => {
    setScan(await libraryApi.startScan());
  };

  const refreshStats = () => {
    preampApi.stats().then(setStats);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col gap-6">
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
          <Button onClick={handleScan} disabled={scan.scanning}>
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${scan.scanning ? "animate-spin" : ""}`}
            />
            {scan.scanning ? "Scanning..." : "Rescan"}
          </Button>
        </div>
      </div>

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

          <ArtistsList artists={artists} />

          <IssuePanel
            stats={stats}
            artists={artists}
            scan={scan}
            onStatsRefresh={refreshStats}
          />
        </>
      )}
    </div>
  );
}
