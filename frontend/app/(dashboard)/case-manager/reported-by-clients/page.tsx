"use client";

import { useMemo, useState } from "react";
import { Calendar, Inbox } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genIncidents, type IncidentRow, BRANDS } from "@/lib/mock-data";

interface ReportedRow {
  caseHash: string;
  reporter: string;
  brand: string;
  type: string;
  url: string;
  reportedAt: string;
  status: "PENDING" | "ACTIVE" | "CLOSED";
}

export default function ReportedByClientsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const total = 184;
  const inc = useMemo(() => genIncidents(pageSize, 500), []);
  const rows: ReportedRow[] = inc.map((i, idx) => ({
    caseHash: i.caseHash,
    reporter: ["Karthik Raja", "Priya Iyer", "Rohit Mehta", "Anita Nair"][idx % 4],
    brand: i.brand,
    type: i.type,
    url: i.url,
    reportedAt: i.openedAt,
    status: idx % 4 === 0 ? "PENDING" : idx % 4 === 1 ? "ACTIVE" : "CLOSED",
  }));

  const cols: Column<ReportedRow>[] = [
    { key: "case", header: "Case ID", render: (r) => <span className="text-[12px] font-mono text-purple-300">CASE : {r.caseHash}</span> },
    { key: "reporter", header: "Reported By", render: (r) => <span className="text-[12px] text-slate-300">{r.reporter}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
    { key: "type", header: "Type", render: (r) => <span className="text-[11.5px] text-slate-400">{r.type}</span> },
    { key: "url", header: "URL", render: (r) => <a className="text-[12px] text-purple-300 hover:text-purple-200" href="#">{r.url}</a> },
    { key: "reported", header: "Reported", render: (r) => <span className="text-[11px] text-slate-500">{r.reportedAt}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Reported Incidents By Clients"
        description="Cases submitted directly by client users via the Report New Case form. Awaiting analyst triage and SOC dispatch."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["PENDING", "ACTIVE", "CLOSED"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>
      <DataTable<ReportedRow>
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
