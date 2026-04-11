"use client";

import { useState, useEffect, useCallback } from "react";
import { api, getOrgId, type Alert } from "@/lib/api";
import { AlertCard } from "@/components/alerts/AlertCard";
import { AlertFilters } from "@/components/alerts/AlertFilters";
import { AlertDetailSheet } from "@/components/alerts/AlertDetailSheet";
import { toast } from "sonner";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export default function AlertsPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState({ severity: "", module: "", status: "" });

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAlerts(orgId, { ...filters, page });
      setAlerts(result.data || []);
      setTotal(result.total || 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch alerts";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleStatusChange = async (alertId: string, status: string) => {
    try {
      await api.updateAlertStatus(orgId, alertId, status);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status } : a)));
      setSelectedAlert(null);
      toast.success(`Alert marked as ${status}`);
    } catch {
      toast.error("Failed to update alert");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-sm text-slate-400 mt-1">{total} total alert{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <AlertFilters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-8 h-8 text-orange-400 mb-3" />
          <p className="text-sm text-slate-400 mb-3">{error}</p>
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">
            {filters.severity || filters.module || filters.status
              ? "No alerts found matching your filters. Try adjusting your search criteria."
              : "No alerts yet. Run a scan from Settings to start detecting threats."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onClick={() => setSelectedAlert(alert)} />
          ))}
        </div>
      )}

      {total > 25 && !loading && !error && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={alerts.length < 25}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700"
          >
            Next
          </button>
        </div>
      )}

      <AlertDetailSheet
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
