"use client";

import { useState, useEffect } from "react";
import { api, type Alert } from "@/lib/api";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function ThreatsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const result = await api.getAlerts(ORG_ID, {
          module: filterModule || undefined,
          severity: filterSeverity || undefined,
        });
        setAlerts(result.data);
      } catch {
        toast.error("Failed to load threats");
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [filterModule, filterSeverity]);

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
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
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
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
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
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-700/50" />

          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="relative flex gap-4 pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-[19px] top-4 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  alert.severity === "critical" ? "bg-red-500" :
                  alert.severity === "high" ? "bg-orange-500" :
                  alert.severity === "medium" ? "bg-yellow-500" :
                  "bg-blue-500"
                }`} />

                <div className="flex-1 bg-slate-900 rounded-xl border border-slate-700/50 p-4 hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
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
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
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
              <div className="text-center py-20 text-slate-500">
                No threats detected yet. Run a scan to start monitoring.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
