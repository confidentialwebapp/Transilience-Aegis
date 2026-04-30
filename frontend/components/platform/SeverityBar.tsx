"use client";

import { cn } from "@/lib/utils";

export type SeverityLevel = "Critical" | "Substantial" | "Moderate" | "Low";

const CFG: Record<SeverityLevel, { color: string; bg: string; pct: number }> = {
  Critical: { color: "#ef4444", bg: "rgba(239,68,68,0.15)", pct: 100 },
  Substantial: { color: "#f97316", bg: "rgba(249,115,22,0.15)", pct: 75 },
  Moderate: { color: "#eab308", bg: "rgba(234,179,8,0.15)", pct: 50 },
  Low: { color: "#10b981", bg: "rgba(16,185,129,0.15)", pct: 25 },
};

export function SeverityBar({ level, className }: { level: SeverityLevel | string; className?: string }) {
  const cfg = CFG[(level as SeverityLevel)] || CFG.Low;
  return (
    <div className={cn("inline-flex flex-col gap-1 min-w-[80px]", className)}>
      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
        {level}
      </span>
      <div className="h-1 rounded-full overflow-hidden w-full" style={{ background: cfg.bg }}>
        <div className="h-full rounded-full" style={{ width: `${cfg.pct}%`, background: cfg.color }} />
      </div>
    </div>
  );
}

interface SeverityCountersProps {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  className?: string;
}

export function SeverityCounters({ critical = 0, high = 0, medium = 0, low = 0, className }: SeverityCountersProps) {
  const items = [
    { count: critical, color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
    { count: high, color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
    { count: medium, color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)" },
    { count: low, color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  ];
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {items.map((it, i) => (
        <span
          key={i}
          className="min-w-[24px] h-6 px-1.5 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ background: it.bg, color: it.color, border: `1px solid ${it.border}` }}
        >
          {it.count}
        </span>
      ))}
    </div>
  );
}
