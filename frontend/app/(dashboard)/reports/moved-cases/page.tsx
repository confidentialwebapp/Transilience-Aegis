"use client";

import { useMemo, useState } from "react";
import { Calendar, ArrowRight } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genIncidents, type IncidentRow, BRANDS } from "@/lib/mock-data";

interface MovedRow {
  caseHash: string;
  brand: string;
  fromBucket: string;
  toBucket: string;
  reason: string;
  movedAt: string;
  status: IncidentRow["status"];
}

export default function MovedCasesReport() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const total = 96;
  const incidents = useMemo(() => genIncidents(pageSize, 350), []);
  const rows: MovedRow[] = incidents.map((i, idx) => ({
    caseHash: i.caseHash,
    brand: i.brand,
    fromBucket: ["Phishing", "Brand Abuse", "Social Media"][idx % 3],
    toBucket: ["Brand Abuse", "Phishing", "Executive"][idx % 3],
    reason: ["Reclassified by analyst", "Auto-promoted by ML", "Client request"][idx % 3],
    movedAt: i.openedAt,
    status: i.status,
  }));

  const cols: Column<MovedRow>[] = [
    { key: "id", header: "Case ID", render: (r) => <span className="text-[12px] font-mono text-purple-300">CASE : {r.caseHash}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "move",
      header: "Move",
      render: (r) => (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-slate-700/30 text-slate-300">{r.fromBucket}</span>
          <ArrowRight className="w-3 h-3 text-purple-400" />
          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
            {r.toBucket}
          </span>
        </div>
      ),
    },
    { key: "reason", header: "Reason", render: (r) => <span className="text-[11.5px] text-slate-400">{r.reason}</span> },
    { key: "moved", header: "Moved At", render: (r) => <span className="text-[11px] text-slate-500">{r.movedAt}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Moved Cases"
        description="Cases that have been re-categorised between buckets — useful for measuring classification drift and analyst overrides."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="From" options={["Phishing", "Brand Abuse", "Social Media", "Email"]} />
          <FilterSelect label="To" options={["Phishing", "Brand Abuse", "Social Media", "Email"]} />
          <FilterInput icon={Calendar} placeholder="Date range" />
        </div>
      </FilterCard>
      <DataTable<MovedRow>
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
