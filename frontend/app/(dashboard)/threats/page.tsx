"use client";

import { useState, useEffect } from "react";
import { api, getOrgId, type Alert } from "@/lib/api";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ThreatsPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getAlerts(orgId, {
          module: filterModule || undefined,
          severity: filterSeverity || undefined,
        });
        setAlerts(result.data || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load threats";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [orgId, filterModule, filterSeverity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Threat Feed</h1>
        <p className="text-sm text-slate-400 mt-1">All detected threats across modules</p>
      </div>

      <div className="flex gap-3">
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
        >
          <option value="">All Modules</option>
          <option value="dark_web">Dark Web</option>
          <option value="brand">Brand</option>
          <option value="data_leak">Data Leak</option>
          <option value="surface_web">Surface Web</option>
          <option value="credential">Credential</option>
          <option value="cert_monitor">Certificate</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-8 h-8 text-orange-400 mb-3" />
          <p className="text-sm text-slate-400 mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 text-slate-300 rounded-lg text-sm transition-colors hover:text-white"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="relative">
          {alerts.length > 0 && (
            <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "rgba(139,92,246,0.12)" }} />
          )}

          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="relative flex gap-4 pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-[19px] top-4 w-3 h-3 rounded-full border-2 border-[#07040B] ${
                  alert.severity === "critical" ? "bg-red-500" :
                  alert.severity === "high" ? "bg-orange-500" :
                  alert.severity === "medium" ? "bg-yellow-500" :
                  "bg-blue-500"
                }`} />

                <div className="flex-1 card-enterprise p-4 hover:border-purple-500/15 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <ModuleBadge module={alert.module} />
                        <SeverityBadge severity={alert.severity} />
                      </div>
                      <h3 className="font-medium">{alert.title}</h3>
                      {alert.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{alert.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                        {alert.source_url && (
                          <a
                            href={alert.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
                          >
                            Source <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <RiskScoreMeter score={alert.risk_score} />
                  </div>
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
                  <AlertTriangle className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">
                  No threats detected yet. Run a scan from Settings to start monitoring.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
