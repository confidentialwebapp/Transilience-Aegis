"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getOrgId } from "@/lib/api";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import {
  Shield, AlertTriangle, RefreshCw, Eye, Globe, Bug, Building2,
  Skull, Radio, Radar, Brain, Zap, ChevronRight,
  ShieldCheck, Target, BarChart3,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";
async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() } });
  if (!res.ok) return null;
  return res.json();
}

const MAP_PATHS = [
  "M 80 85 L 105 60 L 140 55 L 170 70 L 165 95 L 145 120 L 120 130 L 100 125 L 85 110 Z",
  "M 120 140 L 140 135 L 155 155 L 150 190 L 135 210 L 120 200 L 115 170 Z",
  "M 225 60 L 260 55 L 280 65 L 275 85 L 255 90 L 235 85 L 225 75 Z",
  "M 230 95 L 260 90 L 280 100 L 285 140 L 270 175 L 245 180 L 225 155 L 220 120 Z",
  "M 280 50 L 340 40 L 380 55 L 400 75 L 390 100 L 360 110 L 320 105 L 290 90 L 275 70 Z",
  "M 350 115 L 380 110 L 400 120 L 410 140 L 395 150 L 370 145 L 355 130 Z",
  "M 370 170 L 405 165 L 415 180 L 405 200 L 380 200 L 365 185 Z",
];
const THREAT_PINS = [
  { x: 120, y: 90, type: "ransomware" }, { x: 105, y: 80, type: "hacktivism" },
  { x: 245, y: 72, type: "ransomware" }, { x: 255, y: 78, type: "hacktivism" },
  { x: 310, y: 65, type: "darkweb" }, { x: 340, y: 75, type: "darkweb" },
  { x: 290, y: 85, type: "darkweb" }, { x: 315, y: 85, type: "ransomware" },
  { x: 355, y: 65, type: "darkweb" }, { x: 360, y: 120, type: "ransomware" },
  { x: 345, y: 80, type: "hacktivism" }, { x: 280, y: 75, type: "ransomware" },
  { x: 300, y: 70, type: "hacktivism" }, { x: 130, y: 155, type: "darkweb" },
  { x: 250, y: 120, type: "hacktivism" },
];
const PIN_COLORS: Record<string, string> = { ransomware: "#ef4444", darkweb: "#8b5cf6", hacktivism: "#f59e0b" };
const DONUT_COLORS = ["#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981", "#06b6d4"];

export default function DashboardPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [cveStats, setCveStats] = useState<any>(null);
  const [vendorStats, setVendorStats] = useState<any>(null);
  const [infraStats, setInfraStats] = useState<any>(null);
  const [topCves, setTopCves] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [ransomware, setRansomware] = useState<any[]>([]);
  const [feedTab, setFeedTab] = useState<"cve" | "ransomware" | "hacktivism">("cve");

  useEffect(() => { setOrgIdLocal(getOrgId()); }, []);
  const { stats, loading, error } = useDashboardStats(orgId);

  useEffect(() => {
    if (!orgId) return;
    apiFetch("/api/v1/cve/stats").then(setCveStats);
    apiFetch("/api/v1/vendors/stats/summary").then(setVendorStats);
    apiFetch("/api/v1/infrastructure/overview").then(setInfraStats);
    apiFetch("/api/v1/cve/feed?per_page=15&severity=critical").then(d => setTopCves(d?.data || []));
    apiFetch("/api/v1/threat-actors/?per_page=50").then(d => setActors(d?.data || []));
    apiFetch("/api/v1/threat-actors/ransomware").then(d => setRansomware((d?.data || []).slice(0, 10)));
  }, [orgId]);

  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    actors.forEach(a => { const c = a.country || "Unknown"; counts[c] = (counts[c] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [actors]);

  const topTechniques = useMemo(() => {
    const counts: Record<string, number> = {};
    actors.forEach(a => (a.techniques || []).forEach((t: string) => { if (t) counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 8);
  }, [actors]);

  const totalAlerts = stats?.total_alerts ?? 0;
  const criticalAlerts = stats?.alerts_by_severity?.critical ?? 0;

  if (loading) return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3"><Shield className="w-6 h-6 text-purple-400" /><h1 className="text-xl font-bold text-gradient-brand">XVigil</h1><div className="flex items-center gap-2 ml-4"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /><span className="text-xs text-slate-500">Connecting...</span></div></div>
      <div className="grid grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
      <div className="grid grid-cols-3 gap-5"><div className="col-span-2 skeleton h-72" /><div className="skeleton h-72" /></div>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-up"><AlertTriangle className="w-12 h-12 text-orange-400 mb-4" /><h2 className="text-lg font-semibold text-white mb-2">Pipeline Connection Failed</h2><p className="text-sm text-slate-500 mb-4">{error}</p><button onClick={() => window.location.reload()} className="btn-brand px-4 py-2 rounded-lg text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retry</button></div>
  );

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"><Shield className="w-5 h-5 text-purple-400" /></div>
          <div><h1 className="text-xl font-bold text-white">XVigil — Global Threat Intelligence</h1><p className="text-[11px] text-slate-500">Stay ahead of emerging threats with real-time insights</p></div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg stat-card"><div className="status-live" /><span className="text-[11px] text-emerald-400 font-medium ml-1">LIVE</span></div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Feeds", value: totalAlerts, icon: Radio, color: "text-purple-400", sub: "Past 7 days" },
          { label: "Critical", value: criticalAlerts, icon: Zap, color: "text-red-400", sub: "Immediate" },
          { label: "CVEs", value: cveStats?.total ?? 0, icon: Bug, color: "text-orange-400", sub: `${cveStats?.critical ?? 0} critical` },
          { label: "Actors", value: actors.length, icon: Skull, color: "text-pink-400", sub: "MITRE ATT&CK" },
          { label: "Vendors", value: vendorStats?.total ?? 0, icon: Building2, color: "text-emerald-400", sub: "Supply chain" },
          { label: "Assets", value: stats?.total_assets ?? 0, icon: Target, color: "text-blue-400", sub: "Monitored" },
        ].map(s => (
          <div key={s.label} className="stat-card p-3">
            <div className="flex items-center justify-between"><p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Map + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Global Threat Map */}
        <div className="lg:col-span-2 card-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-purple-400" /><h2 className="text-sm font-semibold text-slate-300">Global Threat Map</h2></div>
            <div className="flex items-center gap-3">
              {[{ l: "Hacktivism", c: "#f59e0b" }, { l: "Dark Web", c: "#8b5cf6" }, { l: "Ransomware", c: "#ef4444" }].map(l => (
                <div key={l.l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: l.c }} /><span className="text-[10px] text-slate-500">{l.l}</span></div>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 480 230" className="w-full rounded-lg" style={{ background: "rgba(139,92,246,0.015)" }}>
            {[0,1,2,3,4].map(i => <line key={`h${i}`} x1="0" y1={i*57.5} x2="480" y2={i*57.5} stroke="rgba(139,92,246,0.04)" strokeWidth="0.5" />)}
            {[0,1,2,3,4,5,6,7].map(i => <line key={`v${i}`} x1={i*60} y1="0" x2={i*60} y2="230" stroke="rgba(139,92,246,0.04)" strokeWidth="0.5" />)}
            {MAP_PATHS.map((d, i) => <path key={i} d={d} fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.12)" strokeWidth="0.5" />)}
            {THREAT_PINS.map((pin, i) => (
              <g key={i}>
                <circle cx={pin.x} cy={pin.y} r="6" fill={PIN_COLORS[pin.type]} opacity="0.15"><animate attributeName="r" values="4;12;4" dur={`${2+(i%3)}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.2;0;0.2" dur={`${2+(i%3)}s`} repeatCount="indefinite" /></circle>
                <circle cx={pin.x} cy={pin.y} r="2.5" fill={PIN_COLORS[pin.type]} opacity="0.9" />
              </g>
            ))}
          </svg>
        </div>

        {/* Live Feed */}
        <div className="card-enterprise flex flex-col">
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
            <div className="flex items-center gap-2"><Radio className="w-4 h-4 text-red-400" /><h2 className="text-sm font-semibold text-slate-300">Live Feeds</h2></div>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /><span className="text-[10px] text-red-400">LIVE</span></div>
          </div>
          <div className="flex gap-1 p-2" style={{ borderBottom: "1px solid rgba(139,92,246,0.04)" }}>
            {(["cve","ransomware","hacktivism"] as const).map(t => (
              <button key={t} onClick={() => setFeedTab(t)} className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${feedTab===t?"bg-purple-500/10 text-purple-400":"text-slate-600 hover:text-slate-400"}`}>{t==="cve"?"CVE":t==="ransomware"?"Ransomware":"Hacktivism"}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[320px]">
            {feedTab==="cve" && topCves.map((cve:any,i:number) => (
              <Link href="/cve" key={i} className="block p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2"><span className="font-mono text-[11px] font-bold text-purple-400">{cve.cve_id}</span><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${cve.severity==="critical"?"bg-red-500/15 text-red-400":"bg-orange-500/15 text-orange-400"}`}>{cve.severity?.toUpperCase()}</span></div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{cve.description}</p>
                <div className="flex gap-3 mt-0.5"><span className="text-[9px] text-slate-600">CVSS: {cve.cvss_score}</span>{cve.epss_score>0&&<span className="text-[9px] text-orange-400">EPSS: {(cve.epss_score*100).toFixed(1)}%</span>}</div>
              </Link>
            ))}
            {feedTab==="ransomware" && ransomware.map((g:any,i:number) => (
              <Link href="/threat-actors" key={i} className="block p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Skull className="w-3 h-3 text-red-400" /><span className="text-[11px] font-bold text-red-400">{g.name}</span></div><span className="text-[10px] font-bold text-slate-400">{g.victim_count}</span></div>
                <p className="text-[9px] text-slate-600 mt-0.5">{g.victim_count} victims &bull; {g.status}</p>
              </Link>
            ))}
            {feedTab==="hacktivism" && (stats?.recent_alerts??[]).filter((a:any)=>a.module==="dark_web"||a.module==="brand").slice(0,10).map((a:any,i:number) => (
              <Link href="/alerts" key={i} className="block p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <p className="text-[11px] text-slate-300 line-clamp-1">{a.title}</p><p className="text-[9px] text-slate-600 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
              </Link>
            ))}
            {feedTab==="hacktivism"&&(stats?.recent_alerts??[]).filter((a:any)=>a.module==="dark_web"||a.module==="brand").length===0&&<div className="text-center py-8"><Eye className="w-6 h-6 text-slate-700 mx-auto mb-2" /><p className="text-[10px] text-slate-600">No hacktivism alerts</p></div>}
          </div>
        </div>
      </div>

      {/* Bottom Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Top CVEs */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-300">Top Exploited Vulnerabilities</h3><Link href="/cve" className="text-[10px] text-purple-400 flex items-center gap-1">View All<ChevronRight className="w-3 h-3" /></Link></div>
          <div className="space-y-2">{topCves.slice(0,8).map((cve:any,i:number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-3">{i+1}</span>
              <span className="font-mono text-[10px] text-purple-400 w-28">{cve.cve_id}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}><div className="h-full rounded-full" style={{width:`${(cve.cvss_score/10)*100}%`,background:cve.cvss_score>=9?"#ef4444":cve.cvss_score>=7?"#f97316":"#eab308"}} /></div>
              <span className="text-[10px] font-bold w-6 text-right" style={{color:cve.cvss_score>=9?"#ef4444":cve.cvss_score>=7?"#f97316":"#eab308"}}>{cve.cvss_score}</span>
            </div>
          ))}</div>
        </div>

        {/* Actors Donut */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-300">Threat Actor Origins</h3><Link href="/threat-actors" className="text-[10px] text-purple-400 flex items-center gap-1">View All<ChevronRight className="w-3 h-3" /></Link></div>
          <div className="flex items-center">
            <div className="w-28 h-28"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={countryData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} dataKey="value" strokeWidth={0}>{countryData.map((_,i) => <Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]} />)}</Pie><Tooltip contentStyle={{background:"#110d1a",border:"1px solid rgba(139,92,246,0.15)",borderRadius:"8px",fontSize:"11px",color:"#e2e8f0"}} /></PieChart></ResponsiveContainer></div>
            <div className="flex-1 ml-3 space-y-1">{countryData.slice(0,6).map((c,i) => (
              <div key={c.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:DONUT_COLORS[i]}} /><span className="text-[10px] text-slate-400 flex-1">{c.name}</span><span className="text-[10px] font-bold text-slate-300">{c.value}</span></div>
            ))}</div>
          </div>
        </div>

        {/* Attack Vectors */}
        <div className="card-enterprise p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Attack Vectors (MITRE)</h3>
          <div className="space-y-2">{topTechniques.slice(0,8).map(([tech,count],i) => {
            const max = (topTechniques[0]?.[1] as number)||1;
            return (
              <div key={tech as string} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 w-3">{i+1}</span>
                <span className="font-mono text-[10px] text-slate-400 flex-1 truncate">{tech}</span>
                <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}><div className="h-full rounded-full bg-purple-500" style={{width:`${((count as number)/max)*100}%`}} /></div>
                <span className="text-[10px] font-bold text-purple-400 w-5 text-right">{count}</span>
              </div>
            );
          })}{topTechniques.length===0&&<p className="text-[10px] text-slate-600 text-center py-4">Sync MITRE ATT&CK data</p>}</div>
        </div>
      </div>

      {/* Modules */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Application Modules</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {t:"Dark Web Monitor",i:Eye,c:"#a855f7",h:"/dark-web",s:"Forums, Leaks, Paste Sites",b:"LIVE"},
            {t:"Attack Surface",i:Radar,c:"#3b82f6",h:"/attack-surface",s:`${infraStats?.subdomains?.total??0} subdomains`},
            {t:"Supply Chain",i:Building2,c:"#10b981",h:"/vendors",s:`${vendorStats?.total??0} vendors`},
            {t:"Brand Protection",i:ShieldCheck,c:"#f97316",h:"/threats",s:`${stats?.alerts_by_module?.brand??0} alerts`},
            {t:"CVE Intelligence",i:Bug,c:"#8b5cf6",h:"/cve",s:`${cveStats?.total??0} CVEs`,b:"NVD"},
            {t:"Threat Actors",i:Skull,c:"#ef4444",h:"/threat-actors",s:`${actors.length} actors`},
            {t:"Nexus AI",i:Brain,c:"#f59e0b",h:"/nexus-ai",s:"Risk Quantification",b:"AI"},
            {t:"Exposure",i:BarChart3,c:"#ec4899",h:"/exposure",s:"Sources & Assets"},
          ].map(m => (
            <Link key={m.t} href={m.h} className="card-enterprise p-3.5 group">
              <div className="flex items-start justify-between mb-2"><div className="p-1.5 rounded-lg" style={{background:`${m.c}10`}}><m.i className="w-4 h-4" style={{color:m.c}} /></div>{m.b&&<span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full" style={{background:`${m.c}15`,color:m.c,border:`1px solid ${m.c}30`}}>{m.b}</span>}</div>
              <h3 className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{m.t}</h3>
              <p className="text-[10px] text-slate-600 mt-0.5">{m.s}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
