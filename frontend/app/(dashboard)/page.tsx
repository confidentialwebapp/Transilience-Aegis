"use client";

import { useEffect, useState } from "react";
import { getOrgId } from "@/lib/api";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { ExposureSourcesCard } from "@/components/dashboard/ExposureSourcesCard";
import { MonitoredAssetsGrid } from "@/components/dashboard/MonitoredAssetsGrid";
import { IncidentsDonutChart } from "@/components/dashboard/IncidentsDonutChart";
import { TopAssetsTable } from "@/components/dashboard/TopAssetsTable";
import { ThreatLiveFeed } from "@/components/dashboard/ThreatLiveFeed";
import { AlertTriangle, RefreshCw, ShieldOff } from "lucide-react";

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function DashboardPage() {
  const [orgId, setOrgIdLocal] = useState("");

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);

  const { stats, loading, error } = useDashboardStats(orgId);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Exposure Dashboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Exposure Dashboard</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">Unable to load dashboard</h2>
          <p className="text-sm text-slate-400 max-w-md mb-4">
            {error}. The backend server may be starting up (cold start). Please try again in a moment.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no data at all
  const isEmpty =
    !stats ||
    (stats.total_assets === 0 && stats.total_alerts === 0);

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Exposure Dashboard</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
            <ShieldOff className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">No threats detected</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Add your assets (domains, IPs, emails) and run your first scan to start monitoring for threats, data leaks, and brand impersonation.
          </p>
          <a
            href="/assets"
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add Assets to Start Monitoring
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exposure Dashboard</h1>
        <div className="text-sm text-slate-400">Last 90 days</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/center column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exposure Sources */}
          <ExposureSourcesCard
            totalMentions={stats?.exposure_sources.total_mentions ?? 0}
            suspects={stats?.exposure_sources.suspects_identified ?? 0}
            incidents={stats?.exposure_sources.incidents ?? 0}
            byModule={stats?.alerts_by_module ?? {}}
          />

          {/* Monitored Assets */}
          <MonitoredAssetsGrid assets={stats?.monitored_assets ?? {}} total={stats?.total_assets ?? 0} />

          {/* Bottom row: Donut + Top Assets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IncidentsDonutChart
              data={stats?.alerts_by_module ?? {}}
              total={stats?.total_alerts ?? 0}
            />
            <TopAssetsTable assets={stats?.top_assets ?? []} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ThreatLiveFeed orgId={orgId} initialAlerts={stats?.recent_alerts ?? []} />
        </div>
      </div>
    </div>
  );
}
