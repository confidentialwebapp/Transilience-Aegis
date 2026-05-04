"use client";

import { useEffect, useState } from "react";
import { ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import { fetchFindings, type Finding, SEV_COLOR } from "@/lib/findings";

type Props = {
  /** Server-side filters; all combined with AND. */
  category?: string;
  severity?: string;
  module?: string;
  /** Initial page size; default 50. */
  pageSize?: number;
  /** Hide the title bar (when host page already has a PageHeader). */
  bare?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function shortHost(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url.length > 60 ? url.slice(0, 60) + "…" : url;
  }
}

export function FindingsTable({
  category,
  severity,
  module,
  pageSize = 50,
  bare = false,
  emptyTitle = "No findings yet",
  emptyDesc = "When the next BrandMonitoring scan completes, results land here.",
}: Props) {
  const [items, setItems] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchFindings({ category, severity, module, limit: pageSize, offset });
      setItems(r.items);
      setTotal(r.total);
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setOffset(0); }, [category, severity, module]);
  useEffect(() => { load(); }, [category, severity, module, offset]);

  return (
    <div>
      {!bare && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-slate-400">
            {loading ? "Loading…" : `${total} finding${total === 1 ? "" : "s"}`}
          </p>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      )}

      {error ? (
        <div className="px-3 py-3 rounded-lg text-[12px] text-amber-300"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          {error}
        </div>
      ) : items.length === 0 && !loading ? (
        <div className="rounded-xl py-12 text-center"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(139,92,246,0.18)" }}>
          <AlertTriangle className="w-8 h-8 text-slate-700 mx-auto" />
          <p className="text-[13px] text-slate-400 mt-2 font-medium">{emptyTitle}</p>
          <p className="text-[11px] text-slate-600 mt-1">{emptyDesc}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <table className="w-full text-[12.5px]">
            <thead style={{ background: "rgba(139,92,246,0.05)" }}>
              <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
                <th className="px-4 py-2.5">Sev</th>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Module</th>
                <th className="px-4 py-2.5">Indicator</th>
                <th className="px-4 py-2.5 text-right">Risk</th>
                <th className="px-4 py-2.5">Discovered</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => {
                const sev = SEV_COLOR[f.severity] ?? SEV_COLOR.Informational;
                return (
                  <tr key={f.id} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider"
                        style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.bd}` }}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 max-w-[480px]">
                      <p className="truncate" title={f.title}>{f.title}</p>
                      <p className="text-[10.5px] text-slate-500 truncate" title={f.description}>{f.description}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-[10.5px]">{f.module}</td>
                    <td className="px-4 py-2.5">
                      {f.indicator?.startsWith("http") ? (
                        <a href={f.indicator} target="_blank" rel="noopener noreferrer"
                          className="text-purple-300 hover:text-purple-200 inline-flex items-center gap-1 text-[11px] font-mono">
                          {shortHost(f.indicator)} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300 text-[11px] font-mono">{f.indicator}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono tabular-nums">{f.risk_score}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[10.5px] font-mono">{formatDate(f.discovered_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Showing {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={offset === 0}
              className="px-3 h-8 rounded-lg text-[11px] text-slate-300 disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
              Prev
            </button>
            <button onClick={() => setOffset(offset + pageSize)} disabled={offset + pageSize >= total}
              className="px-3 h-8 rounded-lg text-[11px] text-slate-300 disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
