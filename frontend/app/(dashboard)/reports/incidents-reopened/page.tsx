"use client";

import { useMemo, useState } from "react";
import { Calendar, RotateCcw } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, KPICard, StatusPill, SeverityBar } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genIncidents, type IncidentRow, BRANDS } from "@/lib/mock-data";

export default function IncidentsReopenedReport() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const total = 64;
  const rows = useMemo<IncidentRow[]>(() => genIncidents(pageSize, 200), []);

  const cols: Column<IncidentRow>[] = [
    { key: "id", header: "Case ID", render: (r) => <span className="text-[12px] font-mono text-purple-300">CASE : {r.caseHash}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "type", header: "Type", render: (r) => <span className="text-[11.5px] text-slate-400">{r.type}</span> },
    { key: "url", header: "URL", render: (r) => <a className="text-[12px] text-purple-300 hover:text-purple-200" href="#">{r.url}</a> },
    { key: "severity", header: "Severity", render: (r) => <SeverityBar level={r.severity} /> },
    { key: "status", header: "Current", render: () => <StatusPill status="OPEN" /> },
    { key: "reopens", header: "Reopens", align: "right", render: () => <span className="text-[12px] font-bold text-amber-400 tabular-nums">2</span> },
    { key: "added", header: "First Closed", render: (r) => <span className="text-[11px] text-slate-500">{r.openedAt}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Incidents Reopened"
        description="Cases closed once but reopened due to recurrence on the same surface or actor pivot. High counts here often indicate need for stronger upstream blocking."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Reopen count" options={["1", "2", "3+"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Reopened (30d)" value={64} accent="amber" icon={RotateCcw} />
        <KPICard label="2× Reopened" value={18} accent="red" />
        <KPICard label="3+ Reopened" value={4} accent="red" />
        <KPICard label="% of all closed" value="5.3%" accent="slate" />
      </div>

      <DataTable<IncidentRow>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
      />
    </>
  );
}
