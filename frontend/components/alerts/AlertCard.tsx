"use client";

import { formatDistanceToNow } from "date-fns";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import type { Alert } from "@/lib/api";

const BORDER_COLORS: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-blue-500",
  info: "border-l-slate-500",
};

interface Props {
  alert: Alert;
  onClick: () => void;
}

export function AlertCard({ alert, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 rounded-xl border border-slate-700/50 border-l-4 ${
        BORDER_COLORS[alert.severity] || "border-l-slate-500"
      } p-4 cursor-pointer hover:bg-slate-800/80 transition-colors`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={alert.severity} />
            <ModuleBadge module={alert.module} />
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              alert.status === "open"
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : alert.status === "acknowledged"
                ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                : alert.status === "resolved"
                ? "border-slate-500/30 text-slate-400 bg-slate-500/10"
                : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
            }`}>
              {alert.status}
            </span>
          </div>

          <h3 className="text-sm font-medium truncate">{alert.title}</h3>

          {alert.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{alert.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {alert.assets && (
              <span>Asset: {alert.assets.value}</span>
            )}
            <span>
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        <RiskScoreMeter score={alert.risk_score} />
      </div>
    </div>
  );
}
