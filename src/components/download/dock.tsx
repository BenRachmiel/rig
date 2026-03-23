"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/stores/app-store";
import { PreviewPanel } from "./preview-panel";
import { JobList } from "./job-list";
import { EventLog } from "./event-log";

export function Dock() {
  const resolveMeta = useAppStore((s) => s.resolveMeta);
  const hasPreview = resolveMeta !== null;
  const tabs = [
    ...(hasPreview ? [{ id: "preview", label: "Preview" }] : []),
    { id: "jobs", label: "Jobs" },
    { id: "log", label: "Log" },
  ];
  const defaultTab = hasPreview ? "preview" : "jobs";

  return <DockInner tabs={tabs} defaultTab={defaultTab} />;
}

function DockInner({
  tabs,
  defaultTab,
}: {
  tabs: { id: string; label: string }[];
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [tabs, activeTab, defaultTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <Separator className="mb-3" />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {activeTab === "preview" && <PreviewPanel />}
        {activeTab === "jobs" && <JobList />}
        {activeTab === "log" && <EventLog />}
      </div>
    </div>
  );
}
