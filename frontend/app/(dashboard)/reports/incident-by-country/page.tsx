"use client";

import { useEffect, useState } from "react";
import { Map, Globe } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchReportHostCountry } from "@/lib/derived";

export default function IncidentByCountryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportHostCountry().then((j) => setItems(j.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const max = items[0]?.count || 1;

  return (
    <>
      <PageHeader
        title="Incident By Host Country"
        description="Country distribution of finding-host infrastructure — geo-IP'd live via ip-api.com on every page load. Useful for jurisdiction-aware legal escalation."
      />
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Country</th>
              <th className="px-3 py-2.5">Count</th>
              <th className="px-3 py-2.5">Distribution</th>
              <th className="px-3 py-2.5">Sample Hosts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Geo-IP'ing hosts…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No URL-bearing findings to geo-locate.</td></tr>
            ) : items.map((r) => (
              <tr key={r.country} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-200"><Map className="w-3 h-3 inline mr-1.5 text-purple-300" />{r.country}</td>
                <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums">{r.count}</td>
                <td className="px-3 py-2.5 w-1/3">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.08)" }}>
                    <div className="h-full" style={{ width: `${(100 * r.count) / max}%`, background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(r.sample_hosts || []).slice(0, 3).map((h: string) => (
                      <span key={h} className="px-1.5 py-0.5 text-[10px] font-mono rounded text-slate-300"
                        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>{h}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
