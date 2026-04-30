"use client";

import { useMemo, useState } from "react";
import { Globe, Hash, Phone, User } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, DataTable, Toggle, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genDomains, type DomainRow } from "@/lib/mock-data";

export default function MonitoringPage() {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const total = 786;
  const rows = useMemo<DomainRow[]>(
    () => genDomains(Math.min(pageSize, total - (page - 1) * pageSize), (page - 1) * pageSize),
    [page]
  );
  const [monitoringMap, setMonitoringMap] = useState<Record<string, boolean>>({});

  const cols: Column<DomainRow>[] = [
    {
      key: "case",
      header: "Case ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">CASE : {r.caseHash}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Added: {r.added}</p>
          <p className="text-[10px] text-slate-500">Modified: {r.modified}</p>
        </div>
      ),
    },
    {
      key: "monitoring",
      header: "Monitoring",
      render: (r) => {
        const on = monitoringMap[r.caseHash] ?? r.monitoring;
        return (
          <Toggle
            on={on}
            onChange={(v) => setMonitoringMap((m) => ({ ...m, [r.caseHash]: v }))}
          />
        );
      },
    },
    {
      key: "domain",
      header: "Domain",
      render: (r) => (
        <div>
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: r.flag === "New Domain Registration" ? "#fbbf24" : "#a855f7" }}>
            {r.flag}
          </span>
          <p className="text-[12.5px] text-slate-200 mt-0.5">{r.domain}</p>
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Domain Name Monitoring"
        description="Watchlist of low-threat domains with zero reputation, parked status, or whois changes that may indicate impending abuse of monitored brands."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Domain" helper="paste multiple entries separated by commas" />
          <FilterInput icon={Hash} placeholder="Case ID" helper="paste multiple entries separated by commas" />
          <FilterInput icon={User} placeholder="Registrant" />
          <FilterInput icon={Phone} placeholder="Phone" />
          <FilterInput icon={Globe} placeholder="Email" />
        </div>
      </FilterCard>

      <DataTable<DomainRow>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        selectable
      />
    </>
  );
}
