"use client";

import { useEffect, useState } from "react";
import { FilePieChart, Shield, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchReportExecSummary } from "@/lib/derived";
import { SEV_COLOR } from "@/lib/findings";

export default function ExecutiveSummaryPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchReportExecSummary().then(setData).catch(() => {}); }, []);

  if (!data) return <p className="text-[12px] text-slate-500 italic py-12 text-center">Generating executive summary…</p>;

  return (
    <>
      <PageHeader
        title="Executive Summary"
        description={`Board-ready snapshot of ${data.brand}'s external threat posture as of ${new Date(data.as_of).toLocaleString()}.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total findings" value={data.total_findings} icon={Shield} accent="#8b5cf6" />
        <Kpi label="High or above" value={data.high_or_above} icon={AlertTriangle} accent="#ef4444" />
        <Kpi label="Categories" value={Object.keys(data.by_category || {}).length} icon={FilePieChart} accent="#ec4899" />
        <Kpi label="Modules" value={Object.keys(data.by_module || {}).length} icon={Shield} accent="#06b6d4" />
      </div>

      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Top 25 findings by severity × risk score</p>
        <div className="divide-y divide-purple-500/[0.06]">
          {(data.top_findings || []).map((f: any) => {
            const sev = SEV_COLOR[f.severity] ?? SEV_COLOR.Informational;
            return (
              <div key={f.id} className="py-2.5 flex items-start gap-3">
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider"
                  style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.bd}` }}>{f.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-slate-200 truncate" title={f.title}>{f.title}</p>
                  <p className="text-[10.5px] text-slate-500 truncate">{f.module} · risk {f.risk_score}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">By category</p>
          <ul className="space-y-1.5">
            {Object.entries(data.by_category || {}).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-300">{k}</span>
                <span className="text-slate-500 font-mono">{v as number}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">By module</p>
          <ul className="space-y-1.5">
            {Object.entries(data.by_module || {}).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-300 font-mono">{k}</span>
                <span className="text-slate-500 font-mono">{v as number}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, icon: Icon, accent }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">{value}</p>
    </div>
  );
}
