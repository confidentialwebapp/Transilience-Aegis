"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useEffect, useState } from "react";
import { History, Search, RefreshCw, Filter } from "lucide-react";
import { api, getOrgId, type AuditEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<{ total_events_7d: number; unique_users_7d: number; top_actions: Array<{ action: string; count: number }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([
        api.auditList(getOrgId(), { action: actionFilter || undefined }),
        api.auditStats(getOrgId()),
      ]);
      setEvents(e.data);
      setStats(s);
    } catch (e: any) { toast.error(e?.message ?? "load failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [actionFilter]);

  const colorForAction = (a: string) => {
    if (a.includes(".created")) return "#10b981";
    if (a.includes(".updated")) return "#eab308";
    if (a.includes(".deleted") || a.includes(".revoked")) return "#ef4444";
    return "#94a3b8";
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}>
            <History className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Audit Log</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Append-only record of every state-changing action in your org</p>
          </div>
        </div>
        <button onClick={load} className="h-9 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold text-white bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Events (7d)</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{stats?.total_events_7d ?? "—"}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Unique Users (7d)</p>
          <p className="text-[26px] font-bold font-mono text-indigo-300 leading-none mt-2">{stats?.unique_users_7d ?? "—"}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Top Action</p>
          <p className="text-[12px] font-mono text-slate-300 mt-2">{stats?.top_actions?.[0]?.action ?? "—"}</p>
          <p className="text-[10px] text-slate-500">{stats?.top_actions?.[0]?.count ?? 0} times</p>
        </div>
      </div>

      <div className="card-enterprise p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action prefix (e.g. profile., webhook., api_key.)"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/30" />
          </div>
        </div>
        {stats && stats.top_actions.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="text-[10px] text-slate-600 self-center mr-2">quick filter:</span>
            {stats.top_actions.slice(0, 6).map((t) => (
              <button key={t.action} onClick={() => setActionFilter(t.action)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20">
                {t.action} <span className="opacity-60">({t.count})</span>
              </button>
            ))}
            {actionFilter && (
              <button onClick={() => setActionFilter("")} className="px-2 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-400 hover:bg-slate-500/20">clear</button>
            )}
          </div>
        )}
      </div>

      <div className="card-enterprise p-4">
        {loading ? (
          <div className="flex justify-center py-6"><InfinityLoader size={20} /></div>
        ) : events.length === 0 ? (
          <p className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            No audit events {actionFilter && `matching "${actionFilter}"`}. Activity will appear as you and your team use the platform.
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((e) => {
              const c = colorForAction(e.action);
              return (
                <div key={e.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-white/[0.02] border-b border-white/[0.03]">
                  <span className="col-span-2 text-[10px] text-slate-600 font-mono">{new Date(e.created_at).toLocaleString()}</span>
                  <code className="col-span-3 text-[11px] font-mono px-2 py-0.5 rounded inline-block" style={{ color: c, background: `${c}1a`, border: `1px solid ${c}30` }}>{e.action}</code>
                  <span className="col-span-2 text-[11px] text-slate-400">{e.entity_type ?? "—"}</span>
                  <span className="col-span-3 text-[10px] text-slate-500 font-mono truncate" title={JSON.stringify(e.details)}>
                    {Object.keys(e.details || {}).length > 0 ? JSON.stringify(e.details).slice(0, 60) : ""}
                  </span>
                  <span className="col-span-2 text-[10px] text-slate-600 font-mono truncate" title={e.user_id ?? ""}>
                    {e.user_id ? `${e.user_id.slice(0, 8)}…` : "system"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
