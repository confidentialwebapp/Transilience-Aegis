"use client";

import { useEffect, useMemo, useState } from "react";
import { Network, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchTorNodes } from "@/lib/derived";

export default function TorNodesPage() {
  const [items, setItems] = useState<{ ip: string; type: string }[]>([]);
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true); setErr(null);
    try { const j = await fetchTorNodes(); setItems(j.items || []); setAsOf(j.as_of); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => q ? items.filter((n) => n.ip.includes(q)) : items, [items, q]);

  return (
    <>
      <PageHeader
        title="TOR Nodes"
        description="Live Tor exit-node list pulled from the official Tor Project consensus document. Use to enrich SIEM rules, block tor egress, or pivot from an alert IP into onion infrastructure."
      />
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-[11px] text-slate-500">{loading ? "Loading…" : `${filtered.length} of ${items.length} exit nodes · refreshed ${asOf ? new Date(asOf).toLocaleString() : "—"}`}</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search IP…"
              className="h-8 pl-7 pr-3 rounded-lg text-[11.5px] text-slate-200 placeholder:text-slate-600 outline-none"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.18)" }} />
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200"><RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>
      {err && <div className="px-3 py-2 mb-3 rounded-lg text-[12px] text-amber-300" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>{err}</div>}
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">IP</th>
              <th className="px-3 py-2.5">Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={2}>No nodes returned by the Tor Project consensus.</td></tr>
            )}
            {filtered.slice(0, 500).map((n) => (
              <tr key={n.ip} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-slate-200 font-mono"><Network className="w-3 h-3 inline mr-1.5 text-purple-400" />{n.ip}</td>
                <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{n.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 500 && <p className="px-3 py-2 text-[10px] text-slate-600 text-center border-t border-purple-500/[0.06]">Showing first 500 — refine with the search box.</p>}
      </div>
    </>
  );
}
