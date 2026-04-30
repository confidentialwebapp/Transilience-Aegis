"use client";

import { cn } from "@/lib/utils";

const COLORS = [
  { color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)" },
  { color: "#ec4899", bg: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.3)" },
  { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  { color: "#06b6d4", bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.3)" },
  { color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
  { color: "#84cc16", bg: "rgba(132,204,22,0.1)", border: "rgba(132,204,22,0.3)" },
];

function hashIdx(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % COLORS.length;
}

export function TagPill({ label, className, accent }: { label: string; className?: string; accent?: number }) {
  const cfg = COLORS[(accent ?? hashIdx(label)) % COLORS.length];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase whitespace-nowrap",
        className
      )}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {label}
    </span>
  );
}

export function TagGroup({ tags, max = 4 }: { tags: string[]; max?: number }) {
  const shown = tags.slice(0, max);
  const overflow = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <TagPill key={t} label={t} />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider whitespace-nowrap"
          style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
