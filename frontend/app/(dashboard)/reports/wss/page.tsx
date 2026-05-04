"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchReportWss } from "@/lib/derived";
import { SEV_COLOR } from "@/lib/findings";

export default function WssReportsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportWss().then((j) => setItems(j.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Website Scanning Suite Reports"
        description={`Per-scan findings rollup. ${items.length} scan(s) on file, derived from the _scan_source field on every finding in the corpus.`}
      />
      <div className="space-y-3">
        {loading && <p className="text-[12px] text-slate-500 italic">Loading…</p>}
        {items.map((r) => (
          <div key={r.scan_id} className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><ScanLine className="w-3.5 h-3.5 text-purple-300" />
                  <p className="text-[12.5px] font-mono text-slate-200">{r.scan_id}</p>
                </div>
                <p className="text-[10.5px] text-slate-500 mt-0.5">{r.count} total findings</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(r.by_severity || {}).map(([sev, n]) => {
                  const c = (SEV_COLOR as any)[sev] || SEV_COLOR.Informational;
                  return (
                    <span key={sev} className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>
                      {sev}: {n as number}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(r.by_module || {}).map(([m, n]) => (
                <span key={m} className="px-1.5 py-0.5 text-[10px] font-mono rounded text-slate-300"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>{m}: {n as number}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
