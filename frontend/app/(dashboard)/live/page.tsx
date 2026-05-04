"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Globe, Skull, Activity, Target, Flame, Users, ChevronRight } from "lucide-react";
import { GlobalThreatMap } from "@/components/xvigil/GlobalThreatMap";
import { APT_ACTORS, RANSOMWARE_GROUPS } from "@/lib/apt-groups";

export default function LivePage() {
  // Derived stats for the surrounding cards.
  const stats = useMemo(() => {
    const byCountry: Record<string, number> = {};
    APT_ACTORS.forEach((a) => { byCountry[a.country] = (byCountry[a.country] || 0) + 1; });
    const totalRansomVictims = RANSOMWARE_GROUPS.reduce((s, g) => s + g.victim_count, 0);
    return {
      aptCount: APT_ACTORS.length,
      ransomCount: RANSOMWARE_GROUPS.length,
      totalRansomVictims,
      countriesTracked: Object.keys(byCountry).length,
      topCountries: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl p-5 lg:p-6"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.04))",
                 border: "1px solid rgba(139,92,246,0.18)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-purple-300 uppercase">
              <Activity className="w-3 h-3" /> Live Threat Map
            </div>
            <h1 className="text-2xl font-semibold text-white mt-1">Global APT &amp; Attack Activity</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Real-world APT groups and ransomware operators plotted by attribution country.
              The animated ticker simulates fresh activity every few seconds — actor profiles
              are sourced from MITRE ATT&amp;CK, Mandiant, Microsoft Threat Intelligence, and
              CrowdStrike adversary universe.
            </p>
          </div>
          <Link href="/cti/threat-actors" className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[12px] font-semibold text-purple-200 hover:text-white"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Skull className="w-3.5 h-3.5" /> All threat actors <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="APT Groups Tracked" value={stats.aptCount} icon={Skull} accent="#06b6d4" />
        <Kpi label="Ransomware Operators" value={stats.ransomCount} icon={Flame} accent="#ef4444" />
        <Kpi label="Recent Ransom Victims" value={stats.totalRansomVictims.toLocaleString()} icon={Target} accent="#f97316" />
        <Kpi label="Countries Tracked" value={stats.countriesTracked} icon={Globe} accent="#8b5cf6" />
      </div>

      {/* Map */}
      <GlobalThreatMap
        actors={APT_ACTORS}
        ransomwareGroups={RANSOMWARE_GROUPS}
        totalFeeds={stats.aptCount + stats.ransomCount}
      />

      {/* Top countries + recent ransomware */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4"
          style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-3.5 h-3.5 text-purple-300" />
            <p className="text-[11px] font-semibold tracking-[0.13em] text-purple-300 uppercase">Top Source Countries</p>
          </div>
          <ul className="space-y-1.5">
            {stats.topCountries.map(([country, n]) => (
              <li key={country} className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-300">{country}</span>
                <span className="text-slate-500 font-mono tabular-nums">{n} APT group{n === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-3.5 h-3.5 text-red-300" />
            <p className="text-[11px] font-semibold tracking-[0.13em] text-red-300 uppercase">Most-Active Ransomware Operators</p>
          </div>
          <ul className="space-y-1.5">
            {RANSOMWARE_GROUPS.slice(0, 8).map((g) => (
              <li key={g.name} className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-300 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {g.name}
                </span>
                <span className="text-slate-500 font-mono tabular-nums">{g.victim_count} victims · {g.country}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* APT actor catalog */}
      <div className="rounded-xl p-4"
        style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-3.5 h-3.5 text-purple-300" />
          <p className="text-[11px] font-semibold tracking-[0.13em] text-purple-300 uppercase">APT Group Catalog</p>
          <span className="text-[10px] text-slate-500">({APT_ACTORS.length} groups)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead style={{ background: "rgba(139,92,246,0.05)" }}>
              <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Motivation</th>
                <th className="px-3 py-2">Aliases</th>
                <th className="px-3 py-2">First Seen</th>
                <th className="px-3 py-2">Targets</th>
              </tr>
            </thead>
            <tbody>
              {APT_ACTORS.map((a) => (
                <tr key={a.name} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-slate-200 font-semibold">{a.name}</td>
                  <td className="px-3 py-2 text-slate-300">{a.country}</td>
                  <td className="px-3 py-2 text-slate-400 capitalize">{a.motivation.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-slate-500 text-[11px] font-mono">{(a.aliases || []).slice(0, 3).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-slate-500 text-[11px] font-mono">{a.first_seen || "—"}</td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">{(a.targets || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent: string }) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-slate-500 mt-3">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5 font-mono tabular-nums">{value}</p>
    </div>
  );
}
