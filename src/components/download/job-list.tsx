"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/stores/app-store";
import type { JobState } from "@/types/api";

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  queued: "secondary",
  active: "outline",
  done: "default",
  error: "destructive",
};

function JobCard({ job }: { job: JobState }) {
  const [errorsOpen, setErrorsOpen] = useState(false);
  const queueJob = useAppStore((s) => s.queueJob);
  const pct =
    job.track_count > 0 ? (job.tracks_done / job.track_count) * 100 : 0;

  const errorCount = job.errors.length;

  return (
    <Card
      className={`p-3 mb-2 ${job.status === "active" ? "border-muted-foreground/30" : ""}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{job.album}</div>
          <div className="text-xs text-muted-foreground truncate">
            {job.artist}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground/60 font-mono">
            {job.tracks_done}/{job.track_count}
          </span>
          <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>
            {job.status}
          </Badge>
        </div>
      </div>
      <Progress value={pct} className="mt-2 h-0.5" />

      {job.status === "error" && errorCount > 0 && (
        <div className="mt-2">
          <button
            className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive transition-colors"
            onClick={() => setErrorsOpen(!errorsOpen)}
          >
            {errorsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {errorCount} track{errorCount !== 1 ? "s" : ""} failed
          </button>
          {errorsOpen && (
            <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground max-h-32 overflow-y-auto">
              {job.errors.map((err, i) => (
                <li key={i} className="truncate">{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {job.status === "error" && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => queueJob(job.artist, job.album)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
    </Card>
  );
}

export function JobList() {
  const jobs = useAppStore((s) => s.jobs);
  const clearCompletedJobs = useAppStore((s) => s.clearCompletedJobs);

  const jobArray = Array.from(jobs.values());
  const hasCompleted = jobArray.some(
    (j) => j.status === "done" || j.status === "error"
  );

  if (jobArray.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 py-4 text-center">
        No downloads yet
      </div>
    );
  }

  return (
    <div>
      {hasCompleted && (
        <div className="flex justify-end mb-2">
          <Button
            variant="secondary"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={clearCompletedJobs}
          >
            Clear done
          </Button>
        </div>
      )}
      {jobArray.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
