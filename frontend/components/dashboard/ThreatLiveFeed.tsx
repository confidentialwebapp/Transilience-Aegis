"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { RecentAlert } from "@/lib/api";

const SEVERITY_DOTS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-slate-500",
};

interface Props {
  orgId: string;
  initialAlerts: RecentAlert[];
}

export function ThreatLiveFeed({ orgId, initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<RecentAlert[]>(initialAlerts);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    if (!orgId) return;

    let cleanup: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const channel = supabase
          .channel("live-feed")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "alerts",
              filter: `org_id=eq.${orgId}`,
            },
            (payload) => {
              const newAlert = payload.new as RecentAlert;
              setAlerts((prev) => [newAlert, ...prev].slice(0, 30));
            }
          )
          .subscribe((status) => {
            setRealtimeConnected(status === "SUBSCRIBED");
          });

        cleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {
        // Supabase not configured - degrade gracefully
        setRealtimeConnected(false);
      }
    };

    setupRealtime();

    return () => {
      cleanup?.();
    };
  }, [orgId]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Threat Live Feed
        </h2>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${realtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
          <span className={`text-xs ${realtimeConnected ? "text-emerald-400" : "text-slate-500"}`}>
            {realtimeConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No threats detected yet. Scans will populate this feed.
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div
              key={alert.id || `alert-${idx}`}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOTS[alert.severity] || "bg-slate-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-tight truncate">{alert.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">
                    {alert.module?.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-600">|</span>
                  <span className="text-xs text-slate-500">
                    {alert.created_at
                      ? formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })
                      : "just now"}
                  </span>
                </div>
              </div>
              {alert.risk_score > 0 && (
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    alert.risk_score >= 75
                      ? "text-red-400 bg-red-500/10"
                      : alert.risk_score >= 50
                      ? "text-orange-400 bg-orange-500/10"
                      : "text-yellow-400 bg-yellow-500/10"
                  }`}
                >
                  {alert.risk_score}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
