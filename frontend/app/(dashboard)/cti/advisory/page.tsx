"use client";

import { useEffect, useState } from "react";
import { FileText, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchAdvisories } from "@/lib/derived";
import { SEV_COLOR } from "@/lib/findings";

export default function AdvisoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdvisories().then((j) => setItems(j.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Cyber Intel Advisory"
        description="Auto-generated security advisories from every High-or-above scan finding. Each advisory includes the affected asset, recommended remediation, and compliance mappings."
      />
      <div className="space-y-3">
        {loading ? (
          <p className="text-[12px] text-slate-500 italic">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-[12px] text-slate-500 italic">No high-severity advisories in the latest scan window.</p>
        ) : items.map((a) => {
          const sev = SEV_COLOR[a.severity] ?? SEV_COLOR.Informational;
          return (
            <div key={a.id} className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: sev.bg, border: `1px solid ${sev.bd}` }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: sev.fg }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[13.5px] font-semibold text-white">{a.title}</h3>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider"
                      style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.bd}` }}>{a.severity}</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider bg-purple-500/12 text-purple-300 border border-purple-500/25">
                      {a.module}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{a.summary}</p>
                  {a.recommendation && (
                    <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-emerald-300">Recommendation</p>
                      <p className="text-[11.5px] text-slate-300 mt-1">{a.recommendation}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10.5px] text-slate-500">
                    <span className="font-mono">{a.id}</span>
                    <span>·</span>
                    <span>Affected: <span className="text-slate-300">{a.affected_asset}</span></span>
                    {a.indicator && (<><span>·</span><a href={a.indicator} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 truncate max-w-[280px]">{a.indicator}</a></>)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
