"use client";

import { Radar, Globe, Lock, Activity } from "lucide-react";
import { PageHeader, KPICard, SeverityCounters } from "@/components/platform";
import { MonthlyBar, DonutBreakdown } from "@/components/platform/ReportChart";

export default function AsmDashboard() {
  return (
    <>
      <PageHeader
        title="ASM Dashboard"
        description="Snapshot of attack-surface coverage, discovery velocity, and severity mix across all monitored domains."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Monitored Domains" value={48} accent="purple" icon={Globe} />
        <KPICard label="Subdomains Discovered" value={2812} accent="blue" icon={Radar} />
        <KPICard label="Avg Coverage" value="74%" accent="green" icon={Activity} />
        <KPICard label="Expiring SSL (30d)" value={12} accent="amber" icon={Lock} />
      </div>

      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">Findings (all surfaces)</h3>
        <SeverityCounters critical={24} high={92} medium={184} low={312} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyBar
          title="New surfaces discovered"
          series={[
            { name: "Subdomains", data: [120, 140, 110, 130, 160, 180, 150, 170, 190, 220, 200], color: "#a855f7" },
            { name: "IPs", data: [30, 35, 28, 32, 40, 42, 38, 44, 50, 56, 52], color: "#ec4899" },
          ]}
        />
        <DonutBreakdown
          title="Surface mix"
          data={[
            { name: "Subdomains", value: 2812, color: "#a855f7" },
            { name: "IPs", value: 432, color: "#ec4899" },
            { name: "Cloud assets", value: 184, color: "#3b82f6" },
            { name: "SaaS tenants", value: 64, color: "#10b981" },
          ]}
        />
      </div>
    </>
  );
}
