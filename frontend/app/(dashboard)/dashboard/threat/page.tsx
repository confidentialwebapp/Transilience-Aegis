"use client";

import { Activity, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { PageHeader, KPICard } from "@/components/platform";
import { MonthlyLineChart, DonutBreakdown } from "@/components/platform/ReportChart";

export default function ThreatDashboard() {
  return (
    <>
      <PageHeader
        title="Threat Dashboard"
        description="Detection volume, severity mix, and surface trends across the entire monitored portfolio."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Active Detections" value={"1,520"} accent="red" icon={Activity} />
        <KPICard label="Critical (24h)" value={24} accent="red" icon={AlertTriangle} />
        <KPICard label="Mitigated (7d)" value={486} accent="green" icon={ShieldCheck} />
        <KPICard label="Watchlist" value={786} accent="amber" icon={Eye} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MonthlyLineChart
            title="Detections over time"
            series={[
              { name: "Critical", data: [3, 4, 2, 3, 5, 6, 4, 5, 8, 9, 6], color: "#ef4444" },
              { name: "Substantial", data: [5, 6, 4, 5, 6, 7, 5, 6, 9, 11, 8], color: "#f97316" },
              { name: "Moderate", data: [8, 7, 9, 8, 10, 12, 9, 11, 14, 16, 13], color: "#eab308" },
              { name: "Low", data: [12, 11, 14, 13, 15, 18, 14, 16, 19, 22, 18], color: "#10b981" },
            ]}
            yMax={25}
          />
        </div>
        <DonutBreakdown
          title="Active detection mix"
          data={[
            { name: "Phishing", value: 412, color: "#ef4444" },
            { name: "Brand Abuse", value: 286, color: "#a855f7" },
            { name: "Social Media", value: 312, color: "#ec4899" },
            { name: "Executive Imposters", value: 98, color: "#f97316" },
            { name: "Email Spoof", value: 412, color: "#3b82f6" },
          ]}
        />
      </div>
    </>
  );
}
