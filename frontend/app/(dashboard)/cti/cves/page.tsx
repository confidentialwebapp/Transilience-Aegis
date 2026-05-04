"use client";

import { useEffect, useState } from "react";
import { Bug, RefreshCw, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchCves } from "@/lib/derived";

export default function CvesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [asOf, setAsOf] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { const j = await fetchCves(); setItems(j.items || []); setAsOf(j.as_of); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Vulnerability — CVEs"
        description="Recent High-severity CVEs from the National Vulnerability Database (NVD), plus any CVEs surfaced by Shodan banner enrichment in your scans."
      />
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[11px] text-slate-500">{loading ? "Loading…" : `${items.length} CVEs · refreshed ${asOf ? new Date(asOf).toLocaleString() : "—"}`}</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {err && <div className="px-3 py-2 mb-3 rounded-lg text-[12px] text-amber-300" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>{err}</div>}
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">CVE</th>
              <th className="px-3 py-2.5">Severity</th>
              <th className="px-3 py-2.5">CVSS</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Published</th>
              <th className="px-3 py-2.5">Summary</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={6}>No CVEs in the last fetch window.</td></tr>
            )}
            {items.map((c, i) => (
              <tr key={i} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-purple-300 font-mono">
                  <a href={`https://nvd.nist.gov/vuln/detail/${c.cve_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-purple-200">
                    <Bug className="w-3 h-3" /> {c.cve_id} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </td>
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                    style={{
                      background: c.severity === "CRITICAL" ? "rgba(239,68,68,0.18)" : "rgba(249,115,22,0.15)",
                      color: c.severity === "CRITICAL" ? "#fca5a5" : "#fdba74",
                    }}>{c.severity || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums">{c.cvss ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px]">{c.source || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono">{c.published ? new Date(c.published).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2.5 text-slate-400 text-[11.5px] max-w-[480px] truncate" title={c.summary}>{c.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
