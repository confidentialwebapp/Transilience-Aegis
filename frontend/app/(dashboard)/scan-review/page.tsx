"use client";

import { useState, useEffect, useCallback } from "react";
import { api, getOrgId, type ScanJob, type Alert } from "@/lib/api";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  ChevronRight,
  ExternalLink,
  Filter,
} from "lucide-react";

export default function ScanReviewPage() {
  const [orgId, setOrg] = useState("");
  const [scans, setScans] = useState<ScanJob[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<ScanJob | null>(null);
  const [scanAlerts, setScanAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [filterModule, setFilterModule] = useState("");

  useEffect(() => {
    const id = getOrgId();
    setOrg(id);
    loadScans(id);
  }, []);

  const loadScans = async (oid: string) => {
    setLoading(true);
    try {
      const data = await api.getScans(oid);
      setScans(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  const loadScanAlerts = async (scan: ScanJob) => {
    setSelectedScan(scan);
    setLoadingAlerts(true);
    try {
      const data = await api.getAlerts(orgId, { module: scan.module, page: 1 });
      setScanAlerts(data.data);
    } catch {
      toast.error("Failed to load scan findings");
    } finally {
      setLoadingAlerts(false);
    }
  };

  const triggerScan = async (module: string) => {
    try {
      await api.triggerScan(orgId, module);
      toast.success(`${module.replace(/_/g, " ")} scan triggered`);
      setTimeout(() => loadScans(orgId), 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger scan");
    }
  };

  const filteredScans = filterModule
    ? scans.filter((s) => s.module === filterModule)
    : scans;

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const modules = ["dark_web", "brand", "data_leak", "surface_web", "cert_monitor", "credential"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scan Review</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review all scans performed on your assets with detailed findings
          </p>
        </div>
        <button
          onClick={() => loadScans(orgId)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Quick Scan Triggers */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Run Scans
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {modules.map((mod) => (
            <button
              key={mod}
              onClick={() => triggerScan(mod)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800 transition-colors"
            >
              <Play className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 capitalize text-center">
                {mod.replace(/_/g, " ")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scan History List */}
        <div className="lg:col-span-1 bg-slate-900 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Scan History
            </h2>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
            >
              <option value="">All</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8">
              No scans found. Trigger a scan above.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredScans.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => loadScanAlerts(scan)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedScan?.id === scan.id
                      ? "bg-cyan-500/10 border border-cyan-500/30"
                      : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                  }`}
                >
                  {statusIcon(scan.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium capitalize">
                      {scan.module.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {scan.findings_count} findings |{" "}
                      {scan.started_at
                        ? formatDistanceToNow(new Date(scan.started_at), { addSuffix: true })
                        : "pending"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scan Detail / Findings */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-700/50 p-6">
          {!selectedScan ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Filter className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="text-lg font-medium text-slate-300">Select a scan</h3>
              <p className="text-sm text-slate-500 mt-1">
                Click on a scan from the history to view its findings
              </p>
            </div>
          ) : (
            <>
              {/* Scan header */}
              <div className="border-b border-slate-700/50 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  {statusIcon(selectedScan.status)}
                  <h2 className="text-lg font-semibold capitalize">
                    {selectedScan.module.replace(/_/g, " ")} Scan
                  </h2>
                  <ModuleBadge module={selectedScan.module} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>Status: {selectedScan.status}</span>
                  <span>Findings: {selectedScan.findings_count}</span>
                  {selectedScan.started_at && (
                    <span>
                      Started: {format(new Date(selectedScan.started_at), "PPpp")}
                    </span>
                  )}
                  {selectedScan.completed_at && (
                    <span>
                      Completed: {format(new Date(selectedScan.completed_at), "PPpp")}
                    </span>
                  )}
                </div>
                {selectedScan.error && (
                  <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
                    Error: {selectedScan.error}
                  </div>
                )}
              </div>

              {/* Findings */}
              {loadingAlerts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : scanAlerts.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-8">
                  No findings from this scan module.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {scanAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                    >
                      <RiskScoreMeter score={alert.risk_score} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={alert.severity} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            alert.status === "open"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium">{alert.title}</h4>
                        {alert.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {alert.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>
                            {formatDistanceToNow(new Date(alert.created_at), {
                              addSuffix: true,
                            })}
                          </span>
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
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
