"use client";

import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  accent?: "green" | "red" | "amber" | "purple" | "blue" | "slate";
  icon?: React.ComponentType<{ className?: string }>;
  delta?: { value: string; positive?: boolean };
  className?: string;
}

const ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  green: { color: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.20)" },
  red: { color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.20)" },
  amber: { color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.20)" },
  purple: { color: "#a855f7", bg: "rgba(168,85,247,0.06)", border: "rgba(168,85,247,0.20)" },
  blue: { color: "#3b82f6", bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.20)" },
  slate: { color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.20)" },
};

export function KPICard({ label, value, accent = "purple", icon: Icon, delta, className }: Props) {
  const cfg = ACCENT[accent];
  return (
    <div
      className={cn("rounded-xl px-4 py-3 flex items-center gap-3", className)}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {Icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${cfg.color}1A`, border: `1px solid ${cfg.color}33` }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: cfg.color }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold truncate">{label}</p>
        <p className="text-[20px] font-bold text-white tabular-nums leading-tight mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {delta && (
          <p
            className={cn("text-[10px] font-semibold mt-0.5", delta.positive ? "text-emerald-400" : "text-red-400")}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </p>
        )}
      </div>
    </div>
  );
}
