"use client";

import { useMemo, useState } from "react";
import { Globe, Hash } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityCounters, Toggle } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genWss, type WssRow, BRANDS } from "@/lib/mock-data";

export default function WssPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 184;
  const rows = useMemo<WssRow[]>(() => genWss(pageSize), []);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  const cols: Column<WssRow>[] = [
    {
      key: "id",
      header: "WSS ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">{r.id}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Last Scan: {r.lastScan}</p>
        </div>
      ),
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (r) => {
        const on = enabledMap[r.id] ?? r.enabled;
        return (
          <Toggle
            on={on}
            onChange={(v) => setEnabledMap((m) => ({ ...m, [r.id]: v }))}
          />
        );
      },
    },
    {
      key: "url",
      header: "Target URL",
      render: (r) => (
        <a className="text-[12px] text-purple-300 hover:text-purple-200" href="#">
          {r.url}
        </a>
      ),
    },
    { key: "verdict", header: "Verdict", render: (r) => <StatusPill status={r.verdict} /> },
    {
      key: "findings",
      header: "Findings",
      render: (r) => <SeverityCounters critical={r.critical} high={r.high} medium={r.medium} low={r.low} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Website Scanning Suite"
        description="Threat and vulnerability management providing deep insight across the organisation's web attack surface, including OWASP Top 10, SSL/TLS, and supply-chain script risks."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Target URL" />
          <FilterInput icon={Hash} placeholder="WSS ID" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Verdict" options={["CLEAN", "POTENTIALLY SUSPICIOUS"]} />
        </div>
      </FilterCard>

      <DataTable<WssRow>
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
