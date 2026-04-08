"use client";

import { useState, useEffect } from "react";
import { api, type DashboardSummary } from "@/lib/api";

export function useDashboardStats(orgId: string) {
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const fetchStats = async () => {
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
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [orgId]);

  return { stats, loading, error };
}
