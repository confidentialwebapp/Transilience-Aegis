"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Alert } from "@/lib/api";
import { AlertCard } from "@/components/alerts/AlertCard";
import { AlertFilters } from "@/components/alerts/AlertFilters";
import { AlertDetailSheet } from "@/components/alerts/AlertDetailSheet";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState({ severity: "", module: "", status: "" });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAlerts(ORG_ID, { ...filters, page });
      setAlerts(result.data);
      setTotal(result.total);
    } catch (e) {
      toast.error("Failed to fetch alerts");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleStatusChange = async (alertId: string, status: string) => {
    try {
      await api.updateAlertStatus(ORG_ID, alertId, status);
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
          <p className="text-sm text-slate-400 mt-1">{total} total alerts</p>
        </div>
      </div>

      <AlertFilters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          No alerts found matching your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onClick={() => setSelectedAlert(alert)} />
          ))}
        </div>
      )}

      {total > 25 && (
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
