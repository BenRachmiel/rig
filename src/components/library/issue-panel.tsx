"use client";

import { useState, useCallback } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { IssueTable } from "@/components/library/issue-table";
import { IssueWizard } from "@/components/library/issue-wizard";
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

interface IssuePanelProps {
  stats: Stats;
  artists: LibraryEntry[];
  scan: ScanStatus;
  onStatsRefresh: () => void;
}

export function IssuePanel({ stats, artists, scan, onStatsRefresh }: IssuePanelProps) {
  const [qualityOpen, setQualityOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState<IssueKey | null>(null);
  const [issueData, setIssueData] = useState<IssuesResponse | null>(null);
  const [issueOffset, setIssueOffset] = useState(0);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [wizardIssue, setWizardIssue] = useState<IssueKey | null>(null);

  const fetchIssues = useCallback(async (type: IssueKey, offset: number) => {
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
  }, [issueData]);

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
    const waitForRescan = async () => {
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
    onStatsRefresh();
  };

  const issues: { key: IssueKey; label: string; count: number }[] =
    (Object.entries(ISSUE_LABELS) as [IssueKey, string][])
      .map(([key, label]) => ({
        key,
        label,
        count: stats[key],
      }))
      .filter((i) => i.count > 0);

  const totalIssues = issues.reduce((sum, i) => sum + i.count, 0);

  return (
    <>
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
          {totalIssues === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No data quality issues found — your library is clean.
            </p>
          ) : issues.length > 0 ? (
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
          ) : null}
        </CollapsibleContent>
      </Collapsible>

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
