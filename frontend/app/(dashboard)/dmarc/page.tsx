"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchDmarcStats } from "@/lib/derived";

export default function DmarcPage() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchDmarcStats()
      .then((j) => { setItems(j.items || []); setSummary(j.summary || {}); setAsOf(j.as_of); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="DMARC Dashboard"
        description="Live DMARC posture for every monitored domain — pulled directly from authoritative DNS at page load. Shows active policy (none/quarantine/reject), enforcement %, and aggregate / forensic report destinations."
      />

      {err && <div className="px-3 py-2 mb-3 rounded-lg text-[12px] text-amber-300" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Domains Monitored" value={summary.monitored ?? "—"} icon={Mail} accent="#8b5cf6" />
        <SummaryCard label="p=reject" value={summary.p_reject ?? 0} icon={ShieldCheck} accent="#10b981" />
        <SummaryCard label="p=quarantine" value={summary.p_quarantine ?? 0} icon={ShieldAlert} accent="#f59e0b" />
        <SummaryCard label="p=none / missing" value={(summary.p_none ?? 0) + (summary.missing ?? 0)} icon={ShieldX} accent="#ef4444" />
      </div>

      <p className="text-[11px] text-slate-500 mb-2">As of {asOf ? new Date(asOf).toLocaleString() : "—"}</p>

      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Domain</th>
              <th className="px-3 py-2.5">Policy</th>
              <th className="px-3 py-2.5">PCT</th>
              <th className="px-3 py-2.5">RUA</th>
              <th className="px-3 py-2.5">SPF</th>
              <th className="px-3 py-2.5">Raw</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading DNS records…</td></tr>
            ) : items.map((r) => (
              <tr key={r.domain} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-200 font-mono">{r.domain}</td>
                <td className="px-3 py-2.5">
                  {r.policy ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase"
                      style={{
                        background: r.policy === "reject" ? "rgba(16,185,129,0.15)" : r.policy === "quarantine" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                        color: r.policy === "reject" ? "#6ee7b7" : r.policy === "quarantine" ? "#fcd34d" : "#fca5a5",
                      }}>{r.policy}</span>
                  ) : <span className="text-[11px] text-red-400 font-bold">MISSING</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums">{r.pct ?? "—"}{r.pct ? "%" : ""}</td>
                <td className="px-3 py-2.5 text-slate-400 text-[11px] font-mono">{(r.rua || []).join(", ") || "—"}</td>
                <td className="px-3 py-2.5">
                  {r.spf ? <span className="text-[11px] text-emerald-400">SPF set</span> : <span className="text-[11px] text-amber-400">no SPF</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-[10.5px] font-mono truncate max-w-[300px]" title={r.raw}>{r.raw || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SummaryCard({ label, value, icon: Icon, accent }: any) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">{value}</p>
    </div>
  );
}
