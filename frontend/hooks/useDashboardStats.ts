"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type DashboardSummary } from "@/lib/api";

export function useDashboardStats(orgId: string) {
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const data = await api.getDashboardSummary(orgId);
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch dashboard stats");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 60s, but only if initial fetch succeeded
    const interval = setInterval(() => {
      if (!error) {
        api.getDashboardSummary(orgId)
          .then((data) => {
            setStats(data);
            setError(null);
          })
          .catch(() => {
            // Silently fail on background refresh - don't overwrite existing data
          });
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [orgId, fetchStats, error]);

  return { stats, loading, error };
}
