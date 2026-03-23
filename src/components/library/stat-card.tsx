"use client";

import { Card } from "@/components/ui/card";

interface Props {
  label: string;
  value: number | string;
  variant?: "default" | "warning";
  active?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, variant = "default", active, onClick }: Props) {
  return (
    <Card
      className={`p-4 ${variant === "warning" ? "border-amber-500/30 bg-amber-500/5" : ""} ${active ? "ring-2 ring-primary" : ""} ${onClick ? "cursor-pointer hover:border-muted-foreground/40 transition-colors" : ""}`}
      onClick={onClick}
    >
      <p
        className={`text-sm ${variant === "warning" ? "text-amber-500" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
