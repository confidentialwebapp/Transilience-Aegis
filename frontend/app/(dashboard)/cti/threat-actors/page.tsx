"use client";

import { useEffect, useState } from "react";
import { Skull, Globe } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchThreatActors } from "@/lib/derived";

export default function ThreatActorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [byCountry, setByCountry] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetchThreatActors();
        setItems(j.items || []);
        setByCountry(j.by_country || {});
      } catch (e: any) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Threat Actors"
        description={`Curated catalogue of ${items.length} publicly-attributed APT groups, ransomware operators, and hacktivism collectives. Sourced from MITRE ATT&CK, Mandiant, Microsoft Threat Intelligence, and CrowdStrike adversary universe.`}
      />

      {err && <div className="px-3 py-2 mb-3 rounded-lg text-[12px] text-amber-300" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Object.entries(byCountry).slice(0, 4).map(([c, n]) => (
          <div key={c} className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-purple-300" />
              <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">{c}</p>
            </div>
            <p className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Group</th>
              <th className="px-3 py-2.5">Country</th>
              <th className="px-3 py-2.5">Motivation</th>
              <th className="px-3 py-2.5">Aliases</th>
              <th className="px-3 py-2.5">First Seen</th>
              <th className="px-3 py-2.5">Targets</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={6}>Loading…</td></tr>
            ) : items.map((a) => (
              <tr key={a.name} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-200 font-semibold">
                  <div className="flex items-center gap-2"><Skull className="w-3 h-3 text-purple-400" />{a.name}</div>
                </td>
                <td className="px-3 py-2.5 text-slate-300">{a.country}</td>
                <td className="px-3 py-2.5 text-slate-400 capitalize">{(a.motivation || "").replace(/_/g, " ")}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono">{(a.aliases || []).slice(0, 3).join(", ") || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono">{a.first_seen || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px]">{(a.targets || []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
