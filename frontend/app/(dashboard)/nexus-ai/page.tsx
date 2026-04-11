"use client";

import { useState, useEffect } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Brain, Shield, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Loader2, BarChart3, Target, Zap, ChevronRight, Eye, Building2,
  Bug, Skull, Globe, RefreshCw, ArrowRight, Lock, Radio
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
  });
  if (!res.ok) return null;
  return res.json();
}

function RiskGauge({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : score >= 40 ? "#eab308" : score >= 20 ? "#3b82f6" : "#10b981";
  const severity = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : score >= 20 ? "LOW" : "MINIMAL";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 1.5s ease-in-out" }} />
        <text x="50" y="45" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">{score}</text>
        <text x="50" y="60" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600">{severity}</text>
      </svg>
      <span className="text-xs text-slate-500 mt-1">{label}</span>
    </div>
  );
}

function RiskCategory({ label, score, icon: Icon, details }: {
  label: string; score: number; icon: any; details: string;
}) {
  const color = score >= 80 ? "text-red-400" : score >= 60 ? "text-orange-400" : score >= 40 ? "text-yellow-400" : "text-emerald-400";
  const bg = score >= 80 ? "bg-red-500/10 border-red-500/20" : score >= 60 ? "bg-orange-500/10 border-orange-500/20" : score >= 40 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="card-enterprise p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${bg} border`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <span className="text-xs font-semibold text-slate-300">{label}</span>
        </div>
        <span className={`text-lg font-bold ${color}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-1000" style={{
          width: `${score}%`,
          background: score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : score >= 40 ? "#eab308" : "#10b981",
        }} />
      </div>
      <p className="text-[10px] text-slate-600">{details}</p>
    </div>
  );
}

export default function NexusAIPage() {
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any>(null);
  const [computing, setComputing] = useState(false);

  const computeRisk = async () => {
    setComputing(true);
    try {
      const [alerts, cve, vendors, infra] = await Promise.all([
        apiFetch("/api/v1/alerts/stats"),
        apiFetch("/api/v1/cve/stats"),
        apiFetch("/api/v1/vendors/stats/summary"),
        apiFetch("/api/v1/infrastructure/overview"),
      ]);

      // AI risk quantification engine
      const alertScore = Math.min(100, (
        ((alerts?.by_severity?.critical || 0) * 25) +
        ((alerts?.by_severity?.high || 0) * 15) +
        ((alerts?.by_severity?.medium || 0) * 5) +
        ((alerts?.by_severity?.low || 0) * 1)
      ));

      const cveScore = Math.min(100, (
        ((cve?.critical || 0) * 20) +
        ((cve?.high || 0) * 10) +
        ((cve?.kev_count || 0) * 30)
      ));

      const vendorScore = vendors?.avg_risk_score || 0;

      const infraScore = Math.min(100, (
        ((infra?.ssl?.expiring_30d || 0) * 20) +
        ((infra?.dns?.changes_detected || 0) * 15) +
        ((infra?.subdomains?.new || 0) * 5)
      ));

      const overallScore = Math.round(
        (alertScore * 0.35) + (cveScore * 0.25) + (vendorScore * 0.2) + (infraScore * 0.2)
      );

      setRiskData({
        overall: overallScore,
        threat_exposure: alertScore,
        vulnerability: cveScore,
        supply_chain: vendorScore,
        attack_surface: infraScore,
        alerts, cve, vendors, infra,
      });
    } catch {
      toast.error("Risk computation failed");
    } finally {
      setLoading(false);
      setComputing(false);
    }
  };

  useEffect(() => { computeRisk(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
        <Brain className="w-12 h-12 text-purple-400 animate-pulse mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Nexus AI Computing Risk</h2>
        <p className="text-sm text-slate-500">Analyzing threat landscape across all modules...</p>
        <div className="flex items-center gap-2 mt-4">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          <span className="text-xs text-purple-400">Processing intelligence data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/15 to-amber-500/15 border border-purple-500/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nexus AI</h1>
            <p className="text-[11px] text-slate-500">AI-Powered Risk Quantification & Analysis Engine</p>
          </div>
        </div>
        <button onClick={computeRisk} disabled={computing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-all">
          {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Recompute Risk
        </button>
      </div>

      {riskData && (
        <>
          {/* Overall Risk Score */}
          <div className="card-enterprise p-8">
            <div className="flex items-center justify-center gap-12">
              <RiskGauge score={riskData.overall} label="Overall Risk Score" size={160} />
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Organization Risk Posture</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Composite score derived from threat exposure, vulnerability landscape, supply chain risk, and attack surface analysis.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="stat-card p-3">
                    <p className="text-[10px] text-slate-500">Active Threats</p>
                    <p className="text-lg font-bold text-red-400">{riskData.alerts?.total || 0}</p>
                  </div>
                  <div className="stat-card p-3">
                    <p className="text-[10px] text-slate-500">CVE Exposure</p>
                    <p className="text-lg font-bold text-purple-400">{riskData.cve?.total || 0}</p>
                  </div>
                  <div className="stat-card p-3">
                    <p className="text-[10px] text-slate-500">Vendor Risk</p>
                    <p className="text-lg font-bold text-orange-400">{riskData.vendors?.avg_risk_score?.toFixed(0) || 0}</p>
                  </div>
                  <div className="stat-card p-3">
                    <p className="text-[10px] text-slate-500">Surface Findings</p>
                    <p className="text-lg font-bold text-cyan-400">{riskData.infra?.subdomains?.total || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <RiskCategory label="Threat Exposure" score={riskData.threat_exposure} icon={AlertTriangle}
              details={`${riskData.alerts?.by_severity?.critical || 0} critical, ${riskData.alerts?.by_severity?.high || 0} high severity alerts`} />
            <RiskCategory label="Vulnerability Risk" score={riskData.vulnerability} icon={Bug}
              details={`${riskData.cve?.critical || 0} critical CVEs, ${riskData.cve?.kev_count || 0} KEV entries`} />
            <RiskCategory label="Supply Chain Risk" score={riskData.supply_chain} icon={Building2}
              details={`${riskData.vendors?.total || 0} vendors, ${riskData.vendors?.critical || 0} critical risk`} />
            <RiskCategory label="Attack Surface" score={riskData.attack_surface} icon={Globe}
              details={`${riskData.infra?.ssl?.expiring_30d || 0} expiring certs, ${riskData.infra?.dns?.changes_detected || 0} DNS changes`} />
          </div>

          {/* Risk Gauges */}
          <div className="card-enterprise p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-6">Module Risk Scores</h2>
            <div className="flex items-center justify-around">
              <RiskGauge score={riskData.threat_exposure} label="Threat Exposure" />
              <RiskGauge score={riskData.vulnerability} label="Vulnerabilities" />
              <RiskGauge score={riskData.supply_chain} label="Supply Chain" />
              <RiskGauge score={riskData.attack_surface} label="Attack Surface" />
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="card-enterprise p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-300">AI Recommendations</h2>
            </div>
            <div className="space-y-3">
              {riskData.threat_exposure >= 60 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-400">High Threat Exposure Detected</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Review and triage {riskData.alerts?.by_severity?.critical || 0} critical alerts immediately. Consider enabling automated response rules.</p>
                  </div>
                </div>
              )}
              {riskData.vulnerability >= 40 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/[0.03] border border-purple-500/10">
                  <Bug className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-purple-400">Vulnerability Patching Required</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Prioritize patching {riskData.cve?.critical || 0} critical CVEs. {riskData.cve?.kev_count || 0} known exploited vulnerabilities require urgent attention.</p>
                  </div>
                </div>
              )}
              {riskData.supply_chain >= 40 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/[0.03] border border-orange-500/10">
                  <Building2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-400">Vendor Risk Assessment Needed</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Rescan critical-tier vendors. Average vendor risk score is {riskData.vendors?.avg_risk_score?.toFixed(0) || 0}/100.</p>
                  </div>
                </div>
              )}
              {riskData.attack_surface >= 30 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-cyan-500/[0.03] border border-cyan-500/10">
                  <Globe className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-cyan-400">Attack Surface Monitoring</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Review newly discovered subdomains and expiring SSL certificates. DNS changes detected that may indicate domain hijacking.</p>
                  </div>
                </div>
              )}
              {riskData.overall < 20 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10">
                  <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-400">Low Risk Posture</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Your organization&apos;s risk posture is healthy. Continue monitoring and maintain regular scan schedules.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
