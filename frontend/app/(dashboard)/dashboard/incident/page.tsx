"use client";

import { useMemo } from "react";
import { ShieldX, Activity, Clock, CheckCircle } from "lucide-react";
import { PageHeader, KPICard, DataTable, StatusPill, SeverityBar } from "@/components/platform";
import type { Column } from "@/components/platform";
import { MonthlyBar, DonutBreakdown } from "@/components/platform/ReportChart";
import { genIncidents, type IncidentRow } from "@/lib/mock-data";

export default function IncidentDashboard() {
  const recent = useMemo<IncidentRow[]>(() => genIncidents(10), []);

  const cols: Column<IncidentRow>[] = [
    { key: "id", header: "Case", render: (r) => <span className="text-[12px] font-mono text-purple-300">CASE : {r.caseHash}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "url", header: "URL", render: (r) => <a className="text-[12px] text-purple-300 hover:text-purple-200" href="#">{r.url}</a> },
    { key: "severity", header: "Severity", render: (r) => <SeverityBar level={r.severity} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Incident Dashboard"
        description="At-a-glance view of all open and recently closed cases across the portfolio."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Open" value={318} accent="red" icon={ShieldX} />
        <KPICard label="In Progress" value={94} accent="amber" icon={Activity} />
        <KPICard label="Closed (30d)" value={1202} accent="green" icon={CheckCircle} />
        <KPICard label="Avg Time-to-Close" value="08h 42m" accent="purple" icon={Clock} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <MonthlyBar
            title="Cases per month by severity"
            series={[
              { name: "Critical", data: [3, 4, 2, 3, 5, 6, 4, 5, 8, 9, 6], color: "#ef4444" },
              { name: "Substantial", data: [5, 6, 4, 5, 6, 7, 5, 6, 9, 11, 8], color: "#f97316" },
              { name: "Moderate", data: [8, 7, 9, 8, 10, 12, 9, 11, 14, 16, 13], color: "#eab308" },
            ]}
          />
        </div>
        <DonutBreakdown
          title="Open by type"
          data={[
            { name: "Phishing", value: 124, color: "#ef4444" },
            { name: "Brand Abuse", value: 98, color: "#a855f7" },
            { name: "Social Media", value: 72, color: "#ec4899" },
            { name: "Email", value: 24, color: "#3b82f6" },
          ]}
        />
      </div>
      <DataTable<IncidentRow>
        columns={cols}
        rows={recent}
        rowAction={false}
        totalEntries={recent.length}
      />
    </>
  );
}
