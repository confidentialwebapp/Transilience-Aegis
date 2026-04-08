"use client";

import { useDashboardStats } from "@/hooks/useDashboardStats";
import { ExposureSourcesCard } from "@/components/dashboard/ExposureSourcesCard";
import { MonitoredAssetsGrid } from "@/components/dashboard/MonitoredAssetsGrid";
import { IncidentsDonutChart } from "@/components/dashboard/IncidentsDonutChart";
import { TopAssetsTable } from "@/components/dashboard/TopAssetsTable";
import { ThreatLiveFeed } from "@/components/dashboard/ThreatLiveFeed";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats(ORG_ID);

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
          <ThreatLiveFeed orgId={ORG_ID} initialAlerts={stats?.recent_alerts ?? []} />
        </div>
      </div>
    </div>
  );
}
