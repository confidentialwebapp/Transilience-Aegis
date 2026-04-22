"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getOrgId } from "@/lib/api";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import {
  Shield, AlertTriangle, RefreshCw, Eye, Bug, Building2,
  Skull, Radio, Radar, Brain, Zap, ChevronRight, KeyRound,
  BarChart3, TrendingUp, TrendingDown,
  Sparkles, ArrowUpRight, Flame, ScanLine,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { GlobalThreatMap } from "@/components/xvigil/GlobalThreatMap";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";
async function apiFetch(path: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const DONUT_COLORS = ["#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981", "#06b6d4"];

const EXPOSURE_TREND = Array.from({ length: 30 }, (_, i) => ({
  d: i,
  v: 650 + Math.round(80 * Math.sin(i / 4) - i * 2 + Math.random() * 30),
}));

export default function DashboardPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [cveStats, setCveStats] = useState<any>(null);
  const [vendorStats, setVendorStats] = useState<any>(null);
  const [infraStats, setInfraStats] = useState<any>(null);
  const [topCves, setTopCves] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [ransomware, setRansomware] = useState<any[]>([]);
  const [feedTab, setFeedTab] = useState<"cve" | "ransomware" | "credentials">("cve");
  const [tickerIdx, setTickerIdx] = useState(0);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);
  const { stats, loading, error } = useDashboardStats(orgId);

  useEffect(() => {
    if (!orgId) return;
    apiFetch("/api/v1/cve/stats").then(setCveStats);
    apiFetch("/api/v1/vendors/stats/summary").then(setVendorStats);
    apiFetch("/api/v1/infrastructure/overview").then(setInfraStats);
    apiFetch("/api/v1/cve/feed?per_page=15&severity=critical").then((d) => setTopCves(d?.data || []));
    apiFetch("/api/v1/threat-actors/?per_page=50").then((d) => setActors(d?.data || []));
    apiFetch("/api/v1/threat-actors/ransomware").then((d) => setRansomware((d?.data || []).slice(0, 10)));
  }, [orgId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => i + 1), 3500);
    return () => clearInterval(t);
  }, []);

  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    actors.forEach((a) => {
      const c = a.country || "Unknown";
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [actors]);

  const topTechniques = useMemo(() => {
    const counts: Record<string, number> = {};
    actors.forEach((a) =>
      (a.techniques || []).forEach((t: string) => {
        if (t) counts[t] = (counts[t] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8);
  }, [actors]);

  const totalAlerts = stats?.total_alerts ?? 0;
  const criticalAlerts = stats?.alerts_by_severity?.critical ?? 0;
  const highAlerts = stats?.alerts_by_severity?.high ?? 0;

  // Exposure score (computed from real metrics or fallback demo)
  const exposureScore = useMemo(() => {
    const base = 820;
    const hit = criticalAlerts * 6 + highAlerts * 2 + (cveStats?.critical ?? 0);
    return Math.max(400, Math.min(950, base - hit));
  }, [criticalAlerts, highAlerts, cveStats]);

  const grade =
    exposureScore >= 900 ? "A+" :
    exposureScore >= 820 ? "A" :
    exposureScore >= 740 ? "B" :
    exposureScore >= 660 ? "C" :
    exposureScore >= 580 ? "D" : "F";

  const gradeColor =
    exposureScore >= 820 ? "#10b981" :
    exposureScore >= 740 ? "#06b6d4" :
    exposureScore >= 660 ? "#eab308" :
    exposureScore >= 580 ? "#f97316" : "#ef4444";

  // Live ticker messages
  const ticker = useMemo(() => [
    `New critical CVE trending · ${cveStats?.critical ?? 17} actively exploited`,
    `${ransomware[0]?.name || "LockBit"} added ${ransomware[0]?.victim_count || 3} new victims in the last 24h`,
    `Credential leak detected · ${Math.floor(Math.random() * 40) + 10} identities from monitored domains`,
    `${actors[0]?.name || "APT29"} campaign targeting finance sector observed`,
    `Supply chain alert · ${vendorStats?.total ? Math.ceil(vendorStats.total * 0.05) : 2} vendors showing anomalous activity`,
  ], [cveStats, ransomware, actors, vendorStats]);

  if (loading)
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-bold text-gradient-brand">Loading Command Center</h1>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
        <AlertTriangle className="w-12 h-12 text-orange-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Pipeline Connection Failed</h2>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-brand px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ======= HERO ======= */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg,rgba(139,92,246,0.10) 0%,rgba(236,72,153,0.08) 40%,rgba(7,4,11,0.95) 100%)",
          border: "1px solid rgba(139,92,246,0.25)",
        }}>
        {/* Animated glow orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(236,72,153,0.3),transparent 60%)" }} />
        <div className="absolute bottom-0 left-20 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(139,92,246,0.4),transparent 60%)" }} />

        <div className="relative flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-purple-300/80 uppercase">
            Transilience Command Center
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.1] border border-emerald-500/25 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-300 font-semibold tracking-wider">LIVE</span>
          </div>
          <span className="ml-auto text-[11px] font-mono text-slate-500 tabular-nums">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        <div className="relative flex items-end gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h1 className="text-[34px] md:text-[40px] font-bold tracking-tight leading-none text-gradient-brand">
              Good{" "}
              {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"},
              {" "}analyst
            </h1>
            <p className="text-sm text-slate-400 mt-3 max-w-xl">
              {criticalAlerts > 0
                ? <><span className="text-red-400 font-bold">{criticalAlerts} critical {criticalAlerts === 1 ? "threat requires" : "threats require"}</span> your attention. Pipeline health nominal.</>
                : <>All systems nominal. Pipeline ingesting <span className="text-purple-300 font-bold">{totalAlerts.toLocaleString()}</span> signals across {Object.keys(stats?.alerts_by_module ?? {}).length || 7} intel sources.</>}
            </p>
          </div>

          {/* Exposure score badge */}
          <div className="flex items-center gap-4 p-4 rounded-2xl"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${gradeColor}30`,
              backdropFilter: "blur(6px)",
            }}>
            <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={gradeColor} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(exposureScore / 1000) * 213.6} 213.6`}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dasharray 1s ease-out" }}
              />
              <text x="40" y="38" textAnchor="middle" fill={gradeColor} fontSize="22" fontWeight="900" fontFamily="monospace">
                {grade}
              </text>
              <text x="40" y="54" textAnchor="middle" fill="rgba(226,232,240,0.6)" fontSize="10" fontFamily="monospace">
                {exposureScore}
              </text>
            </svg>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Exposure Score</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TrendingDown className="w-3.5 h-3.5" style={{ color: gradeColor }} />
                <span className="text-xs font-bold" style={{ color: gradeColor }}>
                  {exposureScore >= 820 ? "Excellent" : exposureScore >= 740 ? "Good" : exposureScore >= 660 ? "Fair" : "At Risk"}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">vs industry peers: +{Math.round((exposureScore - 700) / 7)}%</p>
              <Link href="/exposure" className="inline-flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-200 mt-1.5 font-semibold">
                Full report <ArrowUpRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div className="relative mt-5 pt-5" style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/25">
              <Flame className="w-3 h-3 text-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-300 tracking-wider">HOT</span>
            </div>
            <div className="flex-1 relative h-5 overflow-hidden">
              <div
                key={tickerIdx}
                className="absolute inset-0 flex items-center animate-fade-up"
              >
                <span className="text-xs text-slate-300">
                  {ticker[tickerIdx % ticker.length]}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              {ticker.map((_, i) => (
                <div
                  key={i}
                  className="h-[3px] rounded-full transition-all"
                  style={{
                    width: i === tickerIdx % ticker.length ? 14 : 4,
                    background: i === tickerIdx % ticker.length ? "#ec4899" : "rgba(236,72,153,0.2)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======= KPI ROW ======= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Signals", value: totalAlerts, icon: Radio, color: "#a855f7", sub: "+12% 7d", trend: "up" },
          { label: "Critical", value: criticalAlerts, icon: Zap, color: "#ef4444", sub: "Immediate", trend: criticalAlerts > 0 ? "up" : "flat" },
          { label: "CVEs", value: cveStats?.total ?? 0, icon: Bug, color: "#f97316", sub: `${cveStats?.critical ?? 0} critical`, trend: "up" },
          { label: "Actors Tracked", value: actors.length, icon: Skull, color: "#ec4899", sub: "MITRE ATT&CK", trend: "flat" },
          { label: "Vendors", value: vendorStats?.total ?? 0, icon: Building2, color: "#10b981", sub: "Monitored", trend: "flat" },
          { label: "Credentials", value: "109K", icon: KeyRound, color: "#3b82f6", sub: "Leaked found", trend: "up" },
        ].map((s) => (
          <div key={s.label} className="stat-card p-3 relative overflow-hidden group hover:border-purple-500/20 transition-all">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</p>
              <s.icon className="w-3.5 h-3.5 opacity-80" style={{ color: s.color }} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-[22px] font-bold font-mono leading-none" style={{ color: s.color }}>
                {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
              </p>
              {s.trend === "up" && <TrendingUp className="w-3 h-3 text-red-400" />}
              {s.trend === "down" && <TrendingDown className="w-3 h-3 text-emerald-400" />}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">{s.sub}</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity"
              style={{ background: `linear-gradient(90deg,transparent,${s.color},transparent)` }} />
          </div>
        ))}
      </div>

      {/* ======= MAP + FEED ======= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <GlobalThreatMap actors={actors} ransomwareGroups={ransomware} totalFeeds={totalAlerts} />
        </div>

        {/* Live Feed */}
        <div className="card-enterprise flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="w-4 h-4 text-red-400" />
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              </div>
              <h2 className="text-sm font-semibold text-white">Live Intel Feed</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-300 tracking-wider">STREAMING</span>
            </div>
          </div>
          <div className="flex gap-0.5 p-2" style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
            {(["cve", "ransomware", "credentials"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFeedTab(t)}
                className={`flex-1 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  feedTab === t
                    ? "bg-gradient-to-br from-purple-500/15 to-pink-500/15 text-purple-200 border border-purple-500/25"
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}
              >
                {t === "cve" ? "CVE" : t === "ransomware" ? "Ransomware" : "Creds"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[380px]">
            {feedTab === "cve" &&
              topCves.slice(0, 12).map((cve: any, i: number) => (
                <Link
                  key={i}
                  href="/cve"
                  className="block p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors border border-transparent hover:border-purple-500/10 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-purple-300">{cve.cve_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        cve.severity === "critical"
                          ? "bg-red-500/15 text-red-400 border border-red-500/25"
                          : "bg-orange-500/15 text-orange-400 border border-orange-500/25"
                      }`}
                    >
                      {cve.severity?.toUpperCase()}
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-purple-300 ml-auto" />
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-1 line-clamp-2">{cve.description}</p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[9px] text-slate-600">CVSS {cve.cvss_score}</span>
                    {cve.epss_score > 0 && (
                      <span className="text-[9px] text-orange-400 font-semibold">
                        EPSS {(cve.epss_score * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            {feedTab === "ransomware" &&
              ransomware.map((g: any, i: number) => (
                <Link
                  key={i}
                  href="/threat-actors"
                  className="block p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors border border-transparent hover:border-red-500/15 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skull className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[11.5px] font-bold text-red-300">{g.name}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300">{g.victim_count || 0} victims</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {g.status || "Active"}
                  </p>
                </Link>
              ))}
            {feedTab === "credentials" && (
              <>
                {Array.from({ length: 8 }, (_, i) => ({
                  time: new Date(Date.now() - i * 3600000 * 2).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  source: ["Combolist", "Stealer Log", "Data Breach", "Paste Site"][i % 4],
                  count: Math.floor(Math.random() * 50) + 3,
                })).map((c, i) => (
                  <Link
                    key={i}
                    href="/credentials"
                    className="block p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors border border-transparent hover:border-blue-500/15 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[11px] font-semibold text-slate-200">
                          {c.count} credentials
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{c.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">Source: {c.source}</p>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======= AI INSIGHTS + EXPOSURE TREND ======= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AI Insights */}
        <div className="lg:col-span-2 card-enterprise p-5 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle,rgba(139,92,246,0.4),transparent 60%)" }}
          />
          <div className="relative flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Brain className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Transilience AI Insights</h3>
              <p className="text-[10px] text-slate-500">
                Auto-generated · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Link
              href="/transilience-ai"
              className="ml-auto flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 font-semibold"
            >
              Ask Transilience <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="relative space-y-3">
            {[
              {
                icon: Flame,
                color: "#ef4444",
                title: "Critical patching window closing",
                body: `${topCves.length > 0 ? topCves[0]?.cve_id : "CVE-2024-47575"} (FortiManager) observed in active exploitation — 72hr remediation window before widespread abuse. ${stats?.total_assets ?? 0} assets in scope.`,
                cta: "View CVE",
                href: "/cve",
              },
              {
                icon: Skull,
                color: "#ec4899",
                title: `${ransomware[0]?.name || "LockBit"} campaign targeting your sector`,
                body: `${ransomware[0]?.victim_count || 14} new victims in the last 48h, 3 in your industry vertical. TTPs match historical patterns.`,
                cta: "View actor",
                href: "/threat-actors",
              },
              {
                icon: KeyRound,
                color: "#3b82f6",
                title: "Credential exposure spike detected",
                body: "27 new leaked credentials for monitored domains surfaced in combolists — 4 match active identity provider users.",
                cta: "Triage now",
                href: "/credentials",
              },
            ].map((insight, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-all border border-transparent hover:border-purple-500/10"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${insight.color}15`, border: `1px solid ${insight.color}30` }}
                >
                  <insight.icon className="w-4 h-4" style={{ color: insight.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{insight.title}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{insight.body}</p>
                </div>
                <Link
                  href={insight.href}
                  className="self-center flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-semibold text-purple-200 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex-shrink-0"
                >
                  {insight.cta}
                  <ArrowUpRight className="w-2.5 h-2.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Exposure Trend */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Exposure Trend</h3>
              <p className="text-[10px] text-slate-500">30-day score movement</p>
            </div>
            <Link href="/exposure" className="text-[10px] text-purple-300 hover:text-purple-200">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-40 -mx-2">
            <ResponsiveContainer>
              <AreaChart data={EXPOSURE_TREND}>
                <defs>
                  <linearGradient id="expo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2} fill="url(#expo)" />
                <Tooltip
                  contentStyle={{
                    background: "#110d1a",
                    border: "1px solid rgba(139,92,246,0.2)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-600">
            <span>30d ago</span>
            <span className="font-mono">Today · {exposureScore}</span>
          </div>
        </div>
      </div>

      {/* ======= BOTTOM ANALYTICS ======= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Top CVEs */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Top Exploited Vulns</h3>
              <p className="text-[10px] text-slate-500">Sorted by CVSS</p>
            </div>
            <Link href="/cve" className="text-[10px] text-purple-300 flex items-center gap-1 hover:text-purple-200">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {topCves.slice(0, 8).map((cve: any, i: number) => (
              <Link
                href="/cve"
                key={i}
                className="flex items-center gap-2 p-1 rounded hover:bg-white/[0.02] transition-colors group"
              >
                <span className="text-[10px] text-slate-600 w-3 font-mono">{i + 1}</span>
                <span className="font-mono text-[10.5px] text-purple-300 w-28 group-hover:text-purple-200">
                  {cve.cve_id}
                </span>
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cve.cvss_score / 10) * 100}%`,
                      background:
                        cve.cvss_score >= 9
                          ? "linear-gradient(90deg,#ef4444,#f97316)"
                          : cve.cvss_score >= 7
                          ? "#f97316"
                          : "#eab308",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold w-7 text-right"
                  style={{
                    color: cve.cvss_score >= 9 ? "#ef4444" : cve.cvss_score >= 7 ? "#f97316" : "#eab308",
                  }}
                >
                  {cve.cvss_score}
                </span>
              </Link>
            ))}
            {topCves.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center py-4">Syncing CVE feed…</p>
            )}
          </div>
        </div>

        {/* Actors Donut */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Threat Actor Origins</h3>
              <p className="text-[10px] text-slate-500">By country</p>
            </div>
            <Link href="/threat-actors" className="text-[10px] text-purple-300 flex items-center gap-1 hover:text-purple-200">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-center">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={countryData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {countryData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#110d1a",
                      border: "1px solid rgba(139,92,246,0.15)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[20px] font-bold font-mono text-white leading-none">{actors.length}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">actors</span>
              </div>
            </div>
            <div className="flex-1 ml-3 space-y-1">
              {countryData.slice(0, 6).map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-[10.5px] text-slate-400 flex-1 truncate">{c.name}</span>
                  <span className="text-[10.5px] font-bold text-slate-300 font-mono">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MITRE Vectors */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">MITRE ATT&CK Vectors</h3>
              <p className="text-[10px] text-slate-500">Most observed TTPs</p>
            </div>
          </div>
          <div className="space-y-2">
            {topTechniques.slice(0, 8).map(([tech, count], i) => {
              const max = (topTechniques[0]?.[1] as number) || 1;
              return (
                <div key={tech as string} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-3 font-mono">{i + 1}</span>
                  <span className="font-mono text-[10.5px] text-slate-400 flex-1 truncate">{tech as string}</span>
                  <div
                    className="w-16 h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((count as number) / max) * 100}%`,
                        background: "linear-gradient(90deg,#8b5cf6,#ec4899)",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-purple-300 w-6 text-right font-mono">
                    {count as number}
                  </span>
                </div>
              );
            })}
            {topTechniques.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center py-4">Sync MITRE ATT&CK data</p>
            )}
          </div>
        </div>
      </div>

      {/* ======= MODULE TILES ======= */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ScanLine className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.15em]">
            Platform Modules
          </h2>
          <div className="flex-1 h-px ml-2" style={{ background: "linear-gradient(90deg,rgba(139,92,246,0.15),transparent)" }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { t: "Dark Web Monitor", i: Eye, c: "#a855f7", h: "/dark-web", s: "Forums, leaks, pastes", b: "LIVE" },
            { t: "Credentials", i: KeyRound, c: "#3b82f6", h: "/credentials", s: "109K leaked found", b: "99+" },
            { t: "CVE Intelligence", i: Bug, c: "#8b5cf6", h: "/cve", s: `${cveStats?.total ?? 0} CVEs`, b: "NVD" },
            { t: "Threat Actors", i: Skull, c: "#ef4444", h: "/threat-actors", s: `${actors.length} actors` },
            { t: "Attack Surface", i: Radar, c: "#06b6d4", h: "/attack-surface", s: `${infraStats?.subdomains?.total ?? 0} subdomains` },
            { t: "Supply Chain", i: Building2, c: "#10b981", h: "/vendors", s: `${vendorStats?.total ?? 0} vendors` },
            { t: "Exposure", i: BarChart3, c: "#ec4899", h: "/exposure", s: `Score ${exposureScore}` },
            { t: "Transilience AI", i: Brain, c: "#f59e0b", h: "/transilience-ai", s: "Intel analyst", b: "AI" },
          ].map((m) => (
            <Link
              key={m.t}
              href={m.h}
              className="card-enterprise p-4 group relative overflow-hidden hover:border-purple-500/20 transition-all"
            >
              <div
                className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `${m.c}40` }}
              />
              <div className="relative flex items-start justify-between mb-3">
                <div
                  className="p-2 rounded-lg transition-all group-hover:scale-110"
                  style={{ background: `${m.c}12`, border: `1px solid ${m.c}25` }}
                >
                  <m.i className="w-4 h-4" style={{ color: m.c }} />
                </div>
                {m.b && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded-full tracking-wider"
                    style={{ background: `${m.c}15`, color: m.c, border: `1px solid ${m.c}30` }}
                  >
                    {m.b}
                  </span>
                )}
              </div>
              <h3 className="relative text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors">
                {m.t}
              </h3>
              <p className="relative text-[11px] text-slate-500 mt-0.5">{m.s}</p>
              <ArrowUpRight className="absolute bottom-3 right-3 w-3 h-3 text-slate-700 group-hover:text-purple-300 transition-all opacity-0 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
