"use client";

import { useMemo, useState } from "react";
import { Globe, Hash, Award } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityCounters } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genAsm, type AsmRow, BRANDS } from "@/lib/mock-data";

export default function AssetMonitoringPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 240;
  const rows = useMemo<AsmRow[]>(() => genAsm(pageSize), []);

  const cols: Column<AsmRow>[] = [
    { key: "id", header: "ASM ID", render: (r) => <span className="text-[12px] font-mono text-purple-300 font-semibold">{r.id}</span> },
    {
      key: "domain",
      header: "Root Domain",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12.5px] text-slate-200 font-semibold">{r.rootDomain}</p>
          <p className="text-[10px] text-slate-500">Domain Expiry: {r.domainExpiry}</p>
          <p className="text-[10px] text-slate-500">SSL Expiry: {r.sslExpiry}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "coverage",
      header: "Coverage",
      align: "right",
      render: (r) => (
        <div className="flex flex-col items-end gap-1 min-w-[60px]">
          <span className="text-[12px] font-bold text-purple-300 tabular-nums">{r.coverage}%</span>
          <div className="w-16 h-1 rounded-full bg-purple-500/10 overflow-hidden">
            <div className="h-full rounded-full bg-purple-400" style={{ width: `${r.coverage}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: "totalAssets",
      header: "Assets",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.totalAssets}</span>,
    },
    {
      key: "discovered",
      header: "Discovered",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.discovered}</span>,
    },
    {
      key: "findings",
      header: "Findings",
      render: (r) => (
        <SeverityCounters critical={r.critical} high={r.high} medium={r.medium} low={r.low} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Asset Monitoring"
        description="Central repository and management of the customer's monitored attack surface. Coverage reflects how much of each domain has been mapped and is under active monitoring."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Root Domain" />
          <FilterInput icon={Hash} placeholder="ASM ID" />
          <FilterSelect icon={Award} label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["ENABLED", "DISABLED"]} />
        </div>
      </FilterCard>

      <DataTable<AsmRow>
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
