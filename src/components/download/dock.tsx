"use client";

import { ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppStore } from "@/stores/app-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PreviewPanel } from "./preview-panel";
import { JobList } from "./job-list";

function DockContent() {
  const dockTab = useAppStore((s) => s.dockTab);
  const setDockTab = useAppStore((s) => s.setDockTab);
  const resolveMeta = useAppStore((s) => s.resolveMeta);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 mb-3">
        {resolveMeta && (
          <Button
            variant={dockTab === "preview" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setDockTab("preview")}
          >
            Preview
          </Button>
        )}
        <Button
          variant={dockTab === "jobs" ? "default" : "ghost"}
          size="sm"
          className="text-xs h-7"
          onClick={() => setDockTab("jobs")}
        >
          Jobs
        </Button>
      </div>
      <Separator className="mb-3" />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {dockTab === "preview" && resolveMeta && <PreviewPanel />}
        {dockTab === "jobs" && <JobList />}
      </div>
    </div>
  );
}

export function Dock() {
  const dockOpen = useAppStore((s) => s.dockOpen);
  const setDockOpen = useAppStore((s) => s.setDockOpen);
  const jobs = useAppStore((s) => s.jobs);
  const isMobile = useMediaQuery("(max-width: 860px)");

  const activeCount = Array.from(jobs.values()).filter(
    (j) => j.status === "queued" || j.status === "active",
  ).length;

  if (isMobile) {
    return (
      <>
        <Button
          className="fixed bottom-18 right-4 z-40 rounded-full h-12 px-4 shadow-lg"
          onClick={() => setDockOpen(true)}
        >
          <ListMusic className="h-4 w-4 mr-1.5" />
          Queue
          {activeCount > 0 && (
            <span className="ml-1.5 bg-primary-foreground text-primary rounded-full text-xs min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {activeCount}
            </span>
          )}
        </Button>

        <Sheet open={dockOpen} onOpenChange={setDockOpen}>
          <SheetContent side="right" className="w-[340px] sm:w-[400px] p-4">
            <SheetHeader>
              <SheetTitle className="text-sm">Queue</SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(100%-3rem)]">
              <DockContent />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="w-[340px] shrink-0 border-l bg-card/50 h-full overflow-hidden flex flex-col">
      <div className="p-4 pb-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Queue
        </h2>
      </div>
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <DockContent />
      </div>
    </div>
  );
}
