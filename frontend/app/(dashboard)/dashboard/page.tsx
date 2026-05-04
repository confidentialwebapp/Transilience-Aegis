"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield, AlertTriangle, Activity, Skull, Eye, Radar, ScanLine,
  ChevronRight, Sparkles, FileText, Globe, RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchStats, fetchFindings, type FindingsStats, type Finding, SEV_COLOR } from "@/lib/findings";

const SEV_PALETTE: Record<string, string> = {
  Critical: "#ef4444", High: "#f97316", Substantial: "#f59e0b",
  Medium: "#eab308", Moderate: "#eab308",
  Low: "#3b82f6", Informational: "#64748b",
};

function shortHost(url?: string) {
  if (!url) return "";
  try { return new URL(url).host; } catch { return url; }
}

function HeroAskBar() {
  const [val, setVal] = useState("");
  const fire = (autoSend: boolean) => {
    const detail = val.trim() ? { prompt: val.trim(), autoSend } : {};
    window.dispatchEvent(new CustomEvent("tai:open", { detail }));
    if (autoSend) setVal("");
  };
  return (
    <div className="mt-4 flex items-center gap-2 max-w-xl rounded-xl pl-3 pr-1.5 h-11"
         style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.22)" }}>
      <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
      <input value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire(true); } }}
        placeholder="Ask Transilience AI anything about your threat data…"
        className="flex-1 bg-transparent outline-none text-[13px] text-slate-100 placeholder:text-slate-500 min-w-0" />
      <kbd className="hidden md:inline-flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-mono text-slate-500 bg-white/5 border border-white/10">⌘J</kbd>
      <button onClick={() => fire(true)} disabled={!val.trim()}
        className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white disabled:opacity-30"
        style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>Ask</button>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<FindingsStats | null>(null);
  const [recent, setRecent] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const [s, r] = await Promise.all([
        fetchStats(),
        fetchFindings({ limit: 12 }),
      ]);
      setStats(s);
      setRecent(r.items);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const sevData = stats ? Object.entries(stats.severity_counts).map(([name, value]) => ({ name, value })) : [];
  const catData = stats ? Object.entries(stats.category_counts).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl p-5 lg:p-6"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.04))",
                 border: "1px solid rgba(139,92,246,0.18)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-purple-300 uppercase">
              <Activity className="w-3 h-3" /> Live · {stats?.brand || "CreditAccess Grameen"}
            </div>
            <h1 className="text-2xl font-semibold text-white mt-1">Command Center</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              External threat posture for your brand, drawn from real BrandMonitoring scan output. Last scan{" "}
              <span className="text-slate-300 font-mono">{stats?.scan_id?.split("-").slice(-2)[0] || "—"}</span>.
            </p>
            <HeroAskBar />
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[12px] text-slate-300 hover:text-white"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="px-3 py-2 rounded-lg text-[12px] text-amber-300"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          {err}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total findings" value={stats?.total_findings ?? "—"} icon={Shield} accent="#8b5cf6" href="/threats" />
        <KpiCard label="High or above" value={stats?.high_or_above ?? "—"} icon={AlertTriangle} accent="#ef4444" href="/threat-management/incidents" />
        <KpiCard label="Categories" value={stats ? Object.keys(stats.category_counts).length : "—"} icon={Eye} accent="#ec4899" href="/cti/ioc-feed" />
        <KpiCard label="Modules run" value={stats ? Object.keys(stats.module_counts).length : "—"} icon={Radar} accent="#06b6d4" href="/asm/wss" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Findings by severity">
          {sevData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                  {sevData.map((e, i) => <Cell key={i} fill={SEV_PALETTE[e.name] || "#64748b"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {sevData.map((e) => (
              <span key={e.name} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px]"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: SEV_PALETTE[e.name] }} />
                <span className="text-slate-300">{e.name}</span>
                <span className="text-slate-500 font-mono tabular-nums">{e.value}</span>
              </span>
            ))}
          </div>
        </Card>

        <Card title="Findings by category">
          {catData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData} margin={{ top: 10, right: 10, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent findings + top hosts */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Card title="Latest findings" cta={{ label: "All threats", href: "/threats" }}>
            {recent.length === 0 ? <Empty /> : (
              <div className="divide-y divide-purple-500/[0.06]">
                {recent.map((f) => {
                  const sev = SEV_COLOR[f.severity] ?? SEV_COLOR.Informational;
                  return (
                    <Link key={f.id} href={`/investigate?id=${f.id}`} className="flex items-start gap-2.5 py-2.5 hover:bg-white/[0.02] transition-colors">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider mt-0.5"
                        style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.bd}` }}>
                        {f.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-slate-200 truncate">{f.title}</p>
                        <p className="text-[10.5px] text-slate-500 truncate">{f.module} · {shortHost(f.indicator)}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-700 mt-1" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
        <Card title="Top affected hosts">
          {!stats || stats.top_hosts.length === 0 ? <Empty /> : (
            <ul className="space-y-1.5">
              {stats.top_hosts.slice(0, 10).map((h) => (
                <li key={h.host} className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-300 truncate font-mono">{h.host}</span>
                  <span className="text-slate-500 font-mono tabular-nums">{h.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/asm/wss" icon={ScanLine} label="Run new scan" />
        <QuickLink href="/threat-management/incidents" icon={AlertTriangle} label="Incidents queue" />
        <QuickLink href="/cti/threat-actors" icon={Skull} label="Threat actors" />
        <QuickLink href="/investigate" icon={Globe} label="Investigate IOC" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, href }: { label: string; value: any; icon: any; accent: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl p-4 transition-all hover:bg-white/[0.02]"
      style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
      </div>
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-slate-500 mt-3">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5 font-mono tabular-nums">{value}</p>
    </Link>
  );
}

function Card({ title, cta, children }: { title: string; cta?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-[0.13em] text-purple-300 uppercase">{title}</p>
        {cta && (
          <Link href={cta.href} className="text-[11px] text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
            {cta.label} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-[12px] text-slate-600 italic py-4">No data — scan results will populate here.</p>;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href} className="rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.02]"
      style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
        <Icon className="w-4 h-4 text-purple-300" />
      </div>
      <span className="text-[12.5px] font-medium text-slate-200">{label}</span>
    </Link>
  );
}
