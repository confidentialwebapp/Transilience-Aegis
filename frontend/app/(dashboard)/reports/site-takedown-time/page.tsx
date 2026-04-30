"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { GraphViewCard, IncidentTypeChart } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

interface RowData {
  type: string;
  total: number;
  open: number;
  avgUptime: string; // hh:mm
  medianUptime: string; // hh:mm
  pending: number;
  closed: number;
}

// Per spec: 11 incident-type rows, only Social Media has data
const ROWS: RowData[] = [
  { type: "Phishing",     total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Malware",      total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Pharming",     total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Smishing",     total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Vishing",      total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Mobile Apps",  total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Social Media", total: 4, open: 0, avgUptime: "34:23", medianUptime: "34:36", pending: 0, closed: 4 },
  { type: "Email",        total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Executive",    total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Other",        total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
  { type: "Domain",       total: 0, open: 0, avgUptime: "00:00", medianUptime: "00:00", pending: 0, closed: 0 },
];

const X_LABELS = ROWS.map((r) => r.type);
// Phishing + Social Media spike to ~340-380 on the chart, everything else flat at 0
const AVG_DATA = X_LABELS.map((l) => (l === "Phishing" ? 380 : l === "Social Media" ? 340 : 0));
const MED_DATA = X_LABELS.map((l) => (l === "Phishing" ? 360 : l === "Social Media" ? 320 : 0));

export default function SiteTakedownTimeReport() {
  const cols: Column<RowData>[] = [
    {
      key: "type",
      header: "Incident Type",
      render: (r) => <span className="text-[12.5px] font-semibold text-slate-200">{r.type}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.total}</span>,
    },
    {
      key: "open",
      header: "Open",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.open}</span>,
    },
    {
      key: "avg",
      header: "Avg Uptime (hh:mm)",
      align: "right",
      render: (r) => <span className="text-[12px] font-mono text-slate-300 tabular-nums">{r.avgUptime}</span>,
    },
    {
      key: "median",
      header: "Median Uptime (hh:mm)",
      align: "right",
      render: (r) => <span className="text-[12px] font-mono text-slate-300 tabular-nums">{r.medianUptime}</span>,
    },
    {
      key: "pending",
      header: "Pending",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.pending}</span>,
    },
    {
      key: "closed",
      header: "Closed",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.closed}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Site Take Down Time"
        description="Recent or historic data of all incidents summarised on incident type with average and median takedown time."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Incident Type" options={X_LABELS} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <DataTable<RowData>
        columns={cols}
        rows={ROWS}
        rowAction={false}
        totalEntries={ROWS.length}
      />

      <div className="mt-4 space-y-4">
        <GraphViewCard title="Graph View" descriptor="Average takedown time by incident type">
          <IncidentTypeChart
            xLabels={X_LABELS}
            series={[
              { name: "Average", data: AVG_DATA, color: "#f97316" },
              { name: "Median",  data: MED_DATA, color: "#3b82f6" },
            ]}
          />
        </GraphViewCard>

        <GraphViewCard title="Graph View" descriptor="Median takedown time by incident type">
          <IncidentTypeChart
            xLabels={X_LABELS}
            series={[
              { name: "Average", data: AVG_DATA, color: "#f97316" },
              { name: "Median",  data: MED_DATA, color: "#3b82f6" },
            ]}
          />
        </GraphViewCard>
      </div>
    </>
  );
}
