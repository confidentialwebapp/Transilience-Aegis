"use client";

import { useState, useEffect } from "react";
import { getOrgId } from "@/lib/api";
import Link from "next/link";
import {
  Radar, Globe, Lock, Wifi, Server, AlertTriangle, Eye,
  Loader2, ChevronRight, Shield, Radio, Clock, ExternalLink,
  Bug, Skull, Database,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";
async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() } });
  if (!res.ok) return null;
  return res.json();
}

const RING_LAYERS = [
  { label: "Core", color: "#8b5cf6", radius: 35 },
  { label: "Web", color: "#3b82f6", radius: 60 },
  { label: "Network", color: "#06b6d4", radius: 85 },
  { label: "Cloud", color: "#10b981", radius: 110 },
  { label: "External", color: "#f97316", radius: 135 },
];

const SURFACE_THREATS = [
  { name: "Expired SSL Certificates", severity: "high", icon: Lock },
  { name: "Exposed Admin Panels", severity: "high", icon: Server },
  { name: "DNS Misconfiguration", severity: "medium", icon: Wifi },
  { name: "Missing DMARC Policy", severity: "medium", icon: Shield },
  { name: "Open Subdomain Takeover", severity: "high", icon: Globe },
  { name: "Weak TLS Configuration", severity: "medium", icon: Lock },
  { name: "Unpatched CVEs on Assets", severity: "critical", icon: Bug },
  { name: "Dark Web Credential Exposure", severity: "critical", icon: Skull },
];

export default function AttackSurfacePage() {
  const [overview, setOverview] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/infrastructure/overview"),
      apiFetch("/api/v1/alerts/?per_page=10"),
    ]).then(([infra, alertsData]) => {
      setOverview(infra);
      setAlerts(alertsData?.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;

  const subCount = overview?.subdomains?.total ?? 0;
  const sslCount = overview?.ssl?.total ?? 0;
  const dnsCount = overview?.dns?.total ?? 0;
  const totalAssets = subCount + sslCount + dnsCount;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Radar className="w-5 h-5 text-blue-400" /></div>
        <div><h1 className="text-xl font-bold text-white">BeVigil — Attack Surface Visibility</h1><p className="text-[11px] text-slate-500">Map, monitor, and secure your external digital footprint</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial Attack Surface Diagram */}
        <div className="lg:col-span-2 card-enterprise p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Attack Surface Topology</h2>
            <span className="text-[10px] text-slate-600">{totalAssets} total assets</span>
          </div>

          <div className="flex items-center gap-8">
            {/* SVG Radial Diagram */}
            <div className="flex-1">
              <svg viewBox="0 0 300 300" className="w-full max-w-[400px] mx-auto">
                {/* Background grid */}
                <circle cx="150" cy="150" r="145" fill="none" stroke="rgba(139,92,246,0.04)" strokeWidth="0.5" />

                {/* Rings */}
                {RING_LAYERS.map((ring, i) => (
                  <g key={ring.label}>
                    <circle cx="150" cy="150" r={ring.radius} fill="none" stroke={ring.color} strokeWidth="1" opacity="0.15" strokeDasharray="4 2" />
                    <circle cx="150" cy="150" r={ring.radius} fill={ring.color} opacity="0.02" />
                  </g>
                ))}

                {/* Center org */}
                <circle cx="150" cy="150" r="20" fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="1.5" />
                <text x="150" y="147" textAnchor="middle" fill="#8b5cf6" fontSize="7" fontWeight="bold">ORG</text>
                <text x="150" y="156" textAnchor="middle" fill="#a78bfa" fontSize="5">Core</text>

                {/* Asset nodes on rings */}
                {subCount > 0 && (
                  <g>
                    <circle cx="210" cy="90" r="8" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1" />
                    <text x="210" y="93" textAnchor="middle" fill="#3b82f6" fontSize="6" fontWeight="bold">{subCount}</text>
                    <text x="232" y="93" fill="#64748b" fontSize="5">Subdomains</text>
                    <line x1="168" y1="140" x2="202" y2="92" stroke="rgba(59,130,246,0.15)" strokeWidth="0.5" />
                  </g>
                )}
                {sslCount > 0 && (
                  <g>
                    <circle cx="95" cy="100" r="8" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1" />
                    <text x="95" y="103" textAnchor="middle" fill="#10b981" fontSize="6" fontWeight="bold">{sslCount}</text>
                    <text x="70" y="103" fill="#64748b" fontSize="5" textAnchor="end">SSL</text>
                    <line x1="135" y1="142" x2="103" y2="102" stroke="rgba(16,185,129,0.15)" strokeWidth="0.5" />
                  </g>
                )}
                {dnsCount > 0 && (
                  <g>
                    <circle cx="150" cy="230" r="8" fill="rgba(249,115,22,0.2)" stroke="#f97316" strokeWidth="1" />
                    <text x="150" y="233" textAnchor="middle" fill="#f97316" fontSize="6" fontWeight="bold">{dnsCount}</text>
                    <text x="150" y="248" fill="#64748b" fontSize="5" textAnchor="middle">DNS Records</text>
                    <line x1="150" y1="170" x2="150" y2="222" stroke="rgba(249,115,22,0.15)" strokeWidth="0.5" />
                  </g>
                )}

                {/* Risk indicators on outer ring */}
                {overview?.subdomains?.new > 0 && (
                  <g>
                    <circle cx="250" cy="150" r="6" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1">
                      <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x="265" y="148" fill="#ef4444" fontSize="5">NEW</text>
                    <text x="265" y="155" fill="#64748b" fontSize="4">{overview.subdomains.new} discovered</text>
                  </g>
                )}
                {overview?.ssl?.expiring_30d > 0 && (
                  <g>
                    <circle cx="55" cy="180" r="6" fill="rgba(249,115,22,0.3)" stroke="#f97316" strokeWidth="1">
                      <animate attributeName="r" values="5;8;5" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <text x="35" y="178" fill="#f97316" fontSize="5" textAnchor="end">EXPIRING</text>
                    <text x="35" y="185" fill="#64748b" fontSize="4" textAnchor="end">{overview.ssl.expiring_30d} certs</text>
                  </g>
                )}

                {/* Ring labels */}
                {RING_LAYERS.map((ring) => (
                  <text key={ring.label} x="150" y={150 - ring.radius + 4} textAnchor="middle" fill={ring.color} fontSize="4" opacity="0.5" fontWeight="bold">{ring.label}</text>
                ))}
              </svg>
            </div>

            {/* Asset Categories */}
            <div className="w-44 space-y-2">
              {[
                { label: "Subdomains", count: subCount, color: "#3b82f6", icon: Globe },
                { label: "SSL Certificates", count: sslCount, color: "#10b981", icon: Lock },
                { label: "DNS Records", count: dnsCount, color: "#f97316", icon: Wifi },
                { label: "New Discovered", count: overview?.subdomains?.new ?? 0, color: "#ef4444", icon: AlertTriangle },
                { label: "Expiring Certs", count: overview?.ssl?.expiring_30d ?? 0, color: "#eab308", icon: Clock },
                { label: "DNS Changes", count: overview?.dns?.changes_detected ?? 0, color: "#ec4899", icon: Database },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  <span className="text-[11px] text-slate-400 flex-1">{item.label}</span>
                  <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attack Surface Threats */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Attack Surface Threats</h2>
            <Link href="/infrastructure" className="text-[10px] text-purple-400 flex items-center gap-1">Details<ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {SURFACE_THREATS.map((threat, i) => {
              const sevColors: Record<string, { bg: string; text: string }> = {
                critical: { bg: "bg-red-500/10", text: "text-red-400" },
                high: { bg: "bg-orange-500/10", text: "text-orange-400" },
                medium: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
              };
              const sc = sevColors[threat.severity] || sevColors.medium;
              return (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <threat.icon className={`w-3.5 h-3.5 ${sc.text}`} />
                  <span className="text-[11px] text-slate-300 flex-1">{threat.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${sc.bg} ${sc.text}`}>{threat.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Underground Intel Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-purple-400" /><h2 className="text-sm font-semibold text-slate-300">Underground Intel Feed</h2></div>
            <Link href="/dark-web" className="text-[10px] text-purple-400 flex items-center gap-1">View All<ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {alerts.filter(a => a.module === "dark_web" || a.module === "credential" || a.module === "data_leak").slice(0, 6).map((alert, i) => (
              <div key={i} className="p-3 rounded-lg hover:bg-white/[0.02] transition-colors" style={{ borderLeft: `2px solid ${alert.severity === "critical" ? "#ef4444" : alert.severity === "high" ? "#f97316" : "#8b5cf6"}` }}>
                <p className="text-[11px] text-slate-300">{alert.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-slate-600">{alert.module?.replace("_", " ")}</span>
                  <span className="text-[9px] text-slate-700">|</span>
                  <span className="text-[9px] text-slate-600">{new Date(alert.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {alerts.filter(a => a.module === "dark_web" || a.module === "credential" || a.module === "data_leak").length === 0 && (
              <p className="text-[11px] text-slate-600 text-center py-6">No underground intel available. Run scans to collect data.</p>
            )}
          </div>
        </div>

        {/* Recent CVEs relevant to attack surface */}
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Bug className="w-4 h-4 text-orange-400" /><h2 className="text-sm font-semibold text-slate-300">CVE Intelligence Feed</h2></div>
            <Link href="/cve" className="text-[10px] text-purple-400 flex items-center gap-1">View All<ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {alerts.filter(a => a.module === "cert_monitor" || a.module === "surface_web").slice(0, 6).map((alert, i) => (
              <div key={i} className="p-3 rounded-lg hover:bg-white/[0.02] transition-colors" style={{ borderLeft: `2px solid ${alert.severity === "critical" ? "#ef4444" : "#f97316"}` }}>
                <p className="text-[11px] text-slate-300">{alert.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-slate-600">Risk: {alert.risk_score}/100</span>
                  <span className="text-[9px] text-slate-700">|</span>
                  <span className="text-[9px] text-slate-600">{new Date(alert.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {alerts.filter(a => a.module === "cert_monitor" || a.module === "surface_web").length === 0 && (
              <p className="text-[11px] text-slate-600 text-center py-6">No surface-related alerts. Infrastructure monitoring is active.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
