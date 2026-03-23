"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { useStatusStream } from "@/hooks/use-status-stream";
import { useResolveStream } from "@/hooks/use-resolve-stream";
import { SearchBar } from "@/components/download/search-bar";
import { AlbumGrid } from "@/components/download/album-grid";
import { Dock } from "@/components/download/dock";

function JobToastWatcher() {
  const jobs = useAppStore((s) => s.jobs);
  const toasted = useRef(new Set<string>());

  useEffect(() => {
    for (const job of jobs.values()) {
      if (job.status === "done" && !toasted.current.has(job.id)) {
        toasted.current.add(job.id);
        toast.success(`${job.album} — ${job.artist}`, {
          description: "Download complete",
        });
      } else if (job.status === "error" && !toasted.current.has(job.id)) {
        toasted.current.add(job.id);
        toast.error(`${job.album} — ${job.artist}`, {
          description: "Download failed",
        });
      }
    }
  }, [jobs]);

  return null;
}

export default function DownloadPage() {
  const loadExistingJobs = useAppStore((s) => s.loadExistingJobs);

  useStatusStream();
  useResolveStream();

  useEffect(() => {
    loadExistingJobs();
  }, [loadExistingJobs]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold tracking-tight mb-4">
            Download
          </h1>
          <SearchBar />
          <AlbumGrid />
        </div>
      </div>

      <div className="w-[340px] shrink-0 border-l bg-card/50 h-full overflow-hidden flex flex-col">
        <div className="p-4 pb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Queue
          </h2>
        </div>
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <Dock />
        </div>
      </div>

      <JobToastWatcher />
    </div>
  );
}
