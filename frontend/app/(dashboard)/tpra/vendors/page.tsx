"use client";

import { useEffect, useState } from "react";
import { Building2, ShieldCheck, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchTprmVendors } from "@/lib/derived";

const GRADE_COLOR: Record<string, { bg: string; fg: string; bd: string }> = {
  A: { bg: "rgba(16,185,129,0.18)", fg: "#6ee7b7", bd: "rgba(16,185,129,0.3)" },
  B: { bg: "rgba(59,130,246,0.15)", fg: "#93c5fd", bd: "rgba(59,130,246,0.3)" },
  C: { bg: "rgba(245,158,11,0.15)", fg: "#fcd34d", bd: "rgba(245,158,11,0.3)" },
  D: { bg: "rgba(249,115,22,0.18)", fg: "#fdba74", bd: "rgba(249,115,22,0.3)" },
  F: { bg: "rgba(239,68,68,0.18)", fg: "#fca5a5", bd: "rgba(239,68,68,0.3)" },
};

export default function VendorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTprmVendors().then((j) => setItems(j.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Third-party JavaScript hosts and supply-chain vendors loading on your brand pages — auto-discovered by the BrandMonitoring supply_chain module. Each is letter-graded by VirusTotal + OTX reputation."
      />
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Vendor (Host)</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Score</th>
              <th className="px-3 py-2.5">VT Malicious</th>
              <th className="px-3 py-2.5">OTX Pulses</th>
              <th className="px-3 py-2.5">First Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No third-party vendors detected on the brand's pages yet.</td></tr>
            ) : items.map((v) => {
              const g = GRADE_COLOR[v.score] || GRADE_COLOR.A;
              return (
                <tr key={v.vendor} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 text-slate-200 font-mono">
                    <Building2 className="w-3 h-3 inline mr-1.5 text-purple-300" />{v.vendor}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-[11.5px]">{v.category}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-bold"
                      style={{ background: g.bg, color: g.fg, border: `1px solid ${g.bd}` }}>{v.score}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums">{v.vt_malicious}</td>
                  <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums">{v.otx_pulses}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono">{v.first_seen ? new Date(v.first_seen).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
