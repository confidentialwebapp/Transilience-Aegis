"use client";

import { useEffect, useState } from "react";
import { getOrgId } from "@/lib/api";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import Link from "next/link";
import {
  BarChart3, Globe, Mail, Server, Hash, Shield, Eye, Radio,
  TrendingUp, AlertTriangle, Clock, ChevronRight, Loader2,
  Fingerprint, Box, Lock, Key, Search,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const DONUT_COLORS = ["#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981", "#06b6d4", "#a78bfa", "#f472b6"];

const ASSET_ICONS: Record<string, any> = {
  domain: Globe, ip: Server, email: Mail, keyword: Search,
  github_org: Hash, social: Eye, certificate: Lock,
};

export default function ExposurePage() {
  const [orgId, setOrgIdLocal] = useState("");
  useEffect(() => { setOrgIdLocal(getOrgId()); }, []);
  const { stats, loading } = useDashboardStats(orgId);

  if (loading) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
  );

  const totalMentions = stats?.exposure_sources?.total_mentions ?? 0;
  const suspects = stats?.exposure_sources?.suspects_identified ?? 0;
  const incidents = stats?.exposure_sources?.incidents ?? 0;
  const moduleData = Object.entries(stats?.alerts_by_module ?? {}).map(([name, value]) => ({ name: name.replace("_", " "), value: value as number })).sort((a, b) => b.value - a.value);
  const assets = stats?.monitored_assets ?? {};
  const topAssets = stats?.top_assets ?? [];
  const totalAlerts = stats?.total_alerts ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">BeVigil — Exposure Sources & Monitoring</h1>
          <p className="text-[11px] text-slate-500">Comprehensive view of your digital exposure, assets, and threat landscape</p>
        </div>
      </div>

      {/* Exposure KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Mentions</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">{totalMentions.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-1">Across all data sources</p>
          <div className="h-1 mt-3 rounded-full" style={{ background: "rgba(139,92,246,0.1)" }}>
            <div className="h-full rounded-full bg-purple-500" style={{ width: "100%" }} />
          </div>
        </div>
        <div className="stat-card p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Suspects Identified</p>
          <p className="text-3xl font-bold text-orange-400 mt-2">{suspects.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-1">{totalMentions > 0 ? ((suspects / totalMentions) * 100).toFixed(1) : 0}% of mentions</p>
          <div className="h-1 mt-3 rounded-full" style={{ background: "rgba(249,115,22,0.1)" }}>
            <div className="h-full rounded-full bg-orange-500" style={{ width: `${totalMentions > 0 ? (suspects / totalMentions) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="stat-card p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Confirmed Incidents</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{incidents.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-1">{totalMentions > 0 ? ((incidents / totalMentions) * 100).toFixed(1) : 0}% conversion rate</p>
          <div className="h-1 mt-3 rounded-full" style={{ background: "rgba(239,68,68,0.1)" }}>
            <div className="h-full rounded-full bg-red-500" style={{ width: `${totalMentions > 0 ? (incidents / totalMentions) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Breakdown */}
        <div className="card-enterprise p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Incidents by Source</h2>
          {moduleData.length > 0 ? (
            <>
              <div className="flex justify-center">
                <div className="w-48 h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={moduleData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                        {moduleData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "8px", fontSize: "11px", color: "#e2e8f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{totalAlerts.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500">incidents</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {moduleData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-[11px] text-slate-400 flex-1 capitalize">{d.name}</span>
                    <span className="text-[11px] font-bold text-slate-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center"><Shield className="w-8 h-8 text-slate-700 mx-auto mb-2" /><p className="text-xs text-slate-600">No incident data yet</p></div>
          )}
        </div>

        {/* Monitored Assets Inventory */}
        <div className="card-enterprise p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Monitored Assets</h2>
          <div className="space-y-2">
            {Object.entries(assets).length > 0 ? Object.entries(assets).map(([type, count]) => {
              const Icon = ASSET_ICONS[type] || Box;
              return (
                <div key={type} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.08)" }}>
                    <Icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-300 capitalize">{type.replace("_", " ")}s</p>
                  </div>
                  <span className="text-lg font-bold text-purple-400">{(count as number).toLocaleString()}</span>
                </div>
              );
            }) : (
              <div className="py-8 text-center"><Box className="w-8 h-8 text-slate-700 mx-auto mb-2" /><p className="text-xs text-slate-600">Add assets to start monitoring</p></div>
            )}
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total Assets</span>
              <span className="text-lg font-bold text-white">{stats?.total_assets ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Top Assets + Live Feed */}
        <div className="space-y-5">
          {/* Top Assets Tag Cloud */}
          <div className="card-enterprise p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Exposed Assets</h2>
            {topAssets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {topAssets.map((asset: any, i: number) => {
                  const typeColors: Record<string, string> = {
                    domain: "#8b5cf6", ip: "#3b82f6", email: "#ec4899", keyword: "#f97316",
                  };
                  const color = typeColors[asset.type] || "#64748b";
                  const size = Math.max(10, Math.min(14, 10 + (asset.mentions / (topAssets[0]?.mentions || 1)) * 4));
                  return (
                    <span key={i} className="px-2 py-1 rounded-lg transition-all hover:scale-105 cursor-default"
                      style={{ background: `${color}10`, border: `1px solid ${color}20`, color, fontSize: `${size}px` }}>
                      {asset.value}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center"><Fingerprint className="w-6 h-6 text-slate-700 mx-auto mb-2" /><p className="text-[10px] text-slate-600">No asset data</p></div>
            )}
          </div>

          {/* Live Threat Feed */}
          <div className="card-enterprise p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Radio className="w-4 h-4 text-red-400" /><h2 className="text-sm font-semibold text-slate-300">Threat Live Feed</h2></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /><span className="text-[10px] text-red-400">LIVE</span></div>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {(stats?.recent_alerts ?? []).slice(0, 6).map((alert: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === "critical" ? "bg-red-500" : alert.severity === "high" ? "bg-orange-500" : "bg-yellow-500"}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-300 line-clamp-1">{alert.title}</p>
                    <p className="text-[9px] text-slate-600">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(stats?.recent_alerts ?? []).length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No recent alerts</p>}
            </div>
            <Link href="/alerts" className="flex items-center justify-center gap-1 mt-3 py-2 rounded-lg text-[11px] text-slate-500 hover:text-purple-400 transition-colors" style={{ background: "rgba(255,255,255,0.02)" }}>
              View All Alerts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
