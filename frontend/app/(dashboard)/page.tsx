"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrgId } from "@/lib/api";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import {
  Shield, AlertTriangle, RefreshCw, Activity, Eye, Globe, Bug, Building2,
  Skull, Radio, Radar, Brain, Zap, TrendingUp, TrendingDown, ArrowRight,
  ChevronRight, Lock, Database, Fingerprint, BarChart3, Cpu, Server,
  Network, FileWarning, ShieldAlert, ShieldCheck, Clock, Target,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
  });
  if (!res.ok) return null;
  return res.json();
}

function StatCard({ label, value, icon: Icon, color, trend, subtitle }: {
  label: string; value: string | number; icon: any; color: string; trend?: string; subtitle?: string;
}) {
  return (
    <div className="stat-card p-4 group hover:border-purple-500/10 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 animate-count ${color}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] text-emerald-400">{trend}</span>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ title, icon: Icon, color, href, stats, badge }: {
  title: string; icon: any; color: string; href: string; stats: string; badge?: string;
}) {
  return (
    <Link href={href} className="card-enterprise p-4 group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg`} style={{ background: `${color}10` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-[11px] text-slate-600 mt-0.5">{stats}</p>
      <div className="flex items-center gap-1 mt-3 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>
        Open Module <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

function ThreatItem({ severity, title, module, time }: {
  severity: string; title: string; module: string; time: string;
}) {
  const colors: Record<string, string> = {
    critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-500", info: "bg-slate-500",
  };
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors group">
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${colors[severity] || colors.info}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 group-hover:text-white transition-colors truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-600">{module}</span>
          <span className="text-[10px] text-slate-700">|</span>
          <span className="text-[10px] text-slate-600">{time}</span>
        </div>
      </div>
    </div>
  );
}

function PipelineStage({ label, icon: Icon, status, color }: {
  label: string; icon: any; status: string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border`}
        style={{ background: `${color}08`, borderColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-medium" style={{ color }}>{status}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [cveStats, setCveStats] = useState<any>(null);
  const [vendorStats, setVendorStats] = useState<any>(null);
  const [infraStats, setInfraStats] = useState<any>(null);

  useEffect(() => { setOrgIdLocal(getOrgId()); }, []);
  const { stats, loading, error } = useDashboardStats(orgId);

  useEffect(() => {
    if (!orgId) return;
    apiFetch("/api/v1/cve/stats").then(setCveStats);
    apiFetch("/api/v1/vendors/stats/summary").then(setVendorStats);
    apiFetch("/api/v1/infrastructure/overview").then(setInfraStats);
  }, [orgId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-bold text-gradient-brand">Command Center</h1>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs text-slate-500">Connecting to threat intelligence pipeline...</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton h-40" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32" />)}
            </div>
          </div>
          <div className="skeleton h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">Pipeline Connection Failed</h2>
        <p className="text-sm text-slate-500 max-w-md mb-4">{error}. The backend is warming up.</p>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-all">
          <RefreshCw className="w-4 h-4" />Retry Connection
        </button>
      </div>
    );
  }

  const totalAlerts = stats?.total_alerts ?? 0;
  const totalAssets = stats?.total_assets ?? 0;
  const criticalAlerts = stats?.alerts_by_severity?.critical ?? 0;
  const highAlerts = stats?.alerts_by_severity?.high ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-600/15 border border-purple-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Command Center</h1>
            <p className="text-[11px] text-slate-500">Real-time threat intelligence & digital risk overview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-purple-500/[0.06]">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-500">Last 90 days</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Threats" value={totalAlerts} icon={ShieldAlert} color="text-red-400" subtitle="All severities" />
        <StatCard label="Critical" value={criticalAlerts} icon={Zap} color="text-red-500" subtitle="Immediate action" />
        <StatCard label="High Risk" value={highAlerts} icon={AlertTriangle} color="text-orange-400" subtitle="Needs review" />
        <StatCard label="Assets Monitored" value={totalAssets} icon={Target} color="text-purple-400" subtitle="Active tracking" />
        <StatCard label="CVEs Tracked" value={cveStats?.total ?? 0} icon={Bug} color="text-purple-400" subtitle={`${cveStats?.critical ?? 0} critical`} />
        <StatCard label="Vendors" value={vendorStats?.total ?? 0} icon={Building2} color="text-emerald-400" subtitle={`${vendorStats?.critical ?? 0} critical risk`} />
      </div>

      {/* AI Pipeline Status */}
      <div className="card-enterprise p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-300">AI Intelligence Pipeline</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-live" />
            <span className="text-[11px] text-emerald-400 font-medium">Active</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4">
          <PipelineStage label="Ingest" icon={Database} status="9 Sources" color="#06b6d4" />
          <div className="flex-1 mx-2 h-px bg-gradient-to-r from-purple-500/20 to-blue-500/20 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <ArrowRight className="w-3 h-3 text-purple-500/30" />
            </div>
          </div>
          <PipelineStage label="Correlate" icon={Network} status="Graph Active" color="#3b82f6" />
          <div className="flex-1 mx-2 h-px bg-gradient-to-r from-blue-500/20 to-purple-500/20 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <ArrowRight className="w-3 h-3 text-blue-500/30" />
            </div>
          </div>
          <PipelineStage label="Predict" icon={Brain} status="AI Ready" color="#8b5cf6" />
          <div className="flex-1 mx-2 h-px bg-gradient-to-r from-purple-500/20 to-orange-500/20 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <ArrowRight className="w-3 h-3 text-purple-500/30" />
            </div>
          </div>
          <PipelineStage label="Triage" icon={BarChart3} status={`${totalAlerts} Events`} color="#f97316" />
          <div className="flex-1 mx-2 h-px bg-gradient-to-r from-orange-500/20 to-red-500/20 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <ArrowRight className="w-3 h-3 text-orange-500/30" />
            </div>
          </div>
          <PipelineStage label="Action" icon={Zap} status={`${criticalAlerts} Critical`} color="#ef4444" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Modules & Exposure */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Modules */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Application Modules</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ModuleCard title="Dark Web Monitor" icon={Eye} color="#a855f7" href="/dark-web" stats="Forums, Paste Sites, Leaks" badge="LIVE" />
              <ModuleCard title="Attack Surface" icon={Radar} color="#06b6d4" href="/infrastructure"
                stats={`${infraStats?.subdomains?.total ?? 0} subdomains, ${infraStats?.ssl?.total ?? 0} certs`} />
              <ModuleCard title="Supply Chain" icon={Building2} color="#10b981" href="/vendors"
                stats={`${vendorStats?.total ?? 0} vendors monitored`} />
              <ModuleCard title="Brand Protection" icon={ShieldCheck} color="#f97316" href="/threats"
                stats={`${stats?.alerts_by_module?.brand ?? 0} brand alerts`} />
              <ModuleCard title="CVE Intelligence" icon={Bug} color="#8b5cf6" href="/cve"
                stats={`${cveStats?.total ?? 0} CVEs, ${cveStats?.kev_count ?? 0} KEV`} badge="NVD" />
              <ModuleCard title="Threat Actors" icon={Skull} color="#ef4444" href="/threat-actors"
                stats="MITRE ATT&CK, TTPs" />
              <ModuleCard title="IOC Lookup" icon={Fingerprint} color="#3b82f6" href="/intel"
                stats="Multi-source aggregation" />
              <ModuleCard title="Nexus AI" icon={Brain} color="#f59e0b" href="/nexus-ai"
                stats="Risk Quantification" badge="AI" />
            </div>
          </div>

          {/* Exposure Breakdown */}
          <div className="card-enterprise p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Threat Distribution by Module</h2>
              <Link href="/alerts" className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {Object.entries(stats?.alerts_by_module ?? {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([module, count]) => {
                const colors: Record<string, string> = {
                  dark_web: "#a855f7", brand: "#f97316", data_leak: "#eab308",
                  surface_web: "#3b82f6", credential: "#ef4444", cert_monitor: "#06b6d4",
                };
                const pct = totalAlerts > 0 ? ((count as number) / totalAlerts) * 100 : 0;
                return (
                  <div key={module} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-24 truncate capitalize">{module.replace("_", " ")}</span>
                    <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: colors[module] || "#64748b" }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-8 text-right">{count as number}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Infrastructure Status */}
          {infraStats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] text-slate-500 uppercase">Subdomains</span>
                </div>
                <p className="text-xl font-bold text-purple-400">{infraStats.subdomains?.total ?? 0}</p>
                {(infraStats.subdomains?.new ?? 0) > 0 && (
                  <p className="text-[10px] text-yellow-400 mt-1">+{infraStats.subdomains.new} new detected</p>
                )}
              </div>
              <div className="stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] text-slate-500 uppercase">SSL Certs</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">{infraStats.ssl?.total ?? 0}</p>
                {(infraStats.ssl?.expiring_30d ?? 0) > 0 && (
                  <p className="text-[10px] text-orange-400 mt-1">{infraStats.ssl.expiring_30d} expiring soon</p>
                )}
              </div>
              <div className="stat-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] text-slate-500 uppercase">DNS Records</span>
                </div>
                <p className="text-xl font-bold text-purple-400">{infraStats.dns?.total ?? 0}</p>
                {(infraStats.dns?.changes_detected ?? 0) > 0 && (
                  <p className="text-[10px] text-red-400 mt-1">{infraStats.dns.changes_detected} changes detected</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Live Feed + Severity */}
        <div className="space-y-6">
          {/* Severity Breakdown */}
          <div className="card-enterprise p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Threat Severity</h2>
            <div className="space-y-3">
              {[
                { label: "Critical", count: criticalAlerts, color: "#ef4444", bg: "bg-red-500" },
                { label: "High", count: highAlerts, color: "#f97316", bg: "bg-orange-500" },
                { label: "Medium", count: stats?.alerts_by_severity?.medium ?? 0, color: "#eab308", bg: "bg-yellow-500" },
                { label: "Low", count: stats?.alerts_by_severity?.low ?? 0, color: "#3b82f6", bg: "bg-blue-500" },
                { label: "Info", count: stats?.alerts_by_severity?.info ?? 0, color: "#64748b", bg: "bg-slate-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${s.bg}`} />
                  <span className="text-xs text-slate-400 w-14">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${totalAlerts > 0 ? (s.count / totalAlerts) * 100 : 0}%`,
                      background: s.color,
                    }} />
                  </div>
                  <span className="text-xs font-bold w-6 text-right" style={{ color: s.color }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Threat Feed */}
          <div className="card-enterprise p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-slate-300">Live Threat Feed</h2>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] text-red-400 font-medium">LIVE</span>
              </div>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {(stats?.recent_alerts ?? []).length === 0 ? (
                <div className="py-8 text-center">
                  <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No threats detected. Monitor is active.</p>
                </div>
              ) : (
                (stats?.recent_alerts ?? []).map((alert: any, i: number) => (
                  <ThreatItem
                    key={alert.id || i}
                    severity={alert.severity}
                    title={alert.title}
                    module={alert.module?.replace("_", " ")}
                    time={new Date(alert.created_at).toLocaleString()}
                  />
                ))
              )}
            </div>
            <Link href="/alerts" className="flex items-center justify-center gap-1 mt-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px] text-slate-500 hover:text-purple-400 hover:border-purple-500/10 transition-all">
              View All Alerts <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="card-enterprise p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Run IOC Lookup", href: "/intel", icon: Fingerprint, color: "text-blue-400" },
                { label: "Investigate Target", href: "/investigate", icon: Target, color: "text-purple-400" },
                { label: "Sync CVE Feed", href: "/cve", icon: Bug, color: "text-purple-400" },
                { label: "Scan Vendor", href: "/vendors", icon: Building2, color: "text-emerald-400" },
              ].map((action) => (
                <Link key={action.label} href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] border border-transparent hover:border-white/[0.04] transition-all group">
                  <action.icon className={`w-4 h-4 ${action.color}`} />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300">{action.label}</span>
                  <ChevronRight className="w-3 h-3 text-slate-700 ml-auto group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
