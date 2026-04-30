"use client";

import { useMemo, useState } from "react";
import { Hash, Calendar, Bug } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, TagPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genCves, type CveRow } from "@/lib/mock-data";

export default function CvesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 330162;
  const rows = useMemo<CveRow[]>(
    () => genCves(pageSize, (page - 1) * pageSize),
    [page]
  );

  const cols: Column<CveRow>[] = [
    {
      key: "id",
      header: "CVE ID",
      render: (r) => (
        <div className="leading-snug max-w-[400px]">
          <p className="text-[12.5px] font-mono text-purple-300 font-semibold">{r.id}</p>
          <p className="text-[11px] text-slate-300 mt-0.5">{r.description}</p>
          <div className="mt-1.5">
            <TagPill label={r.technology} />
          </div>
        </div>
      ),
    },
    { key: "vendor", header: "Vendor", render: (r) => <span className="text-[12px] text-slate-300">{r.vendor}</span> },
    { key: "product", header: "Product", render: (r) => <span className="text-[12px] text-slate-400">{r.product}</span> },
    {
      key: "cvss",
      header: "CVSS",
      align: "right",
      render: (r) => <span className="text-[12px] font-bold text-white tabular-nums">{r.cvss.toFixed(1)}</span>,
    },
    { key: "severity", header: "Severity", render: (r) => <StatusPill status={r.severity} /> },
    { key: "disclosed", header: "Disclosed", render: (r) => <span className="text-[11px] text-slate-400">{r.disclosed}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Vulnerabilities — CVEs"
        description="Comprehensive CVE feed enriched with vendor, product, technology, CVSS, and disclosure context. Cross-referenced against your monitored asset inventory."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Bug} placeholder="CVE ID (CVE-2026-...)" />
          <FilterInput placeholder="Vendor" />
          <FilterInput placeholder="Product" />
          <FilterSelect label="Severity" options={["CRITICAL", "HIGH", "MEDIUM", "LOW"]} />
          <FilterInput icon={Calendar} placeholder="Disclosed After" />
          <FilterInput icon={Hash} placeholder="Min CVSS" />
        </div>
      </FilterCard>

      <DataTable<CveRow>
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
