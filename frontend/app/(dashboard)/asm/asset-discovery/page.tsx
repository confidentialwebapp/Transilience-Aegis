"use client";

import { useMemo, useState } from "react";
import { Globe, Search, AlertTriangle } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityCounters, Toggle } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genDiscovery, type DiscoveryRow, BRANDS } from "@/lib/mock-data";

export default function AssetDiscoveryPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 1208;
  const rows = useMemo<DiscoveryRow[]>(() => genDiscovery(pageSize), []);
  const [monitoringMap, setMonitoringMap] = useState<Record<string, boolean>>({});

  const cols: Column<DiscoveryRow>[] = [
    {
      key: "subdomain",
      header: "Subdomain",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12.5px] text-slate-200 font-semibold">{r.subdomain}</p>
          {r.invalidSsl ? (
            <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Invalid SSL
            </p>
          ) : (
            <p className="text-[10px] text-slate-500">SSL Expiry: {r.sslExpiry}</p>
          )}
        </div>
      ),
    },
    {
      key: "monitoring",
      header: "Monitoring",
      render: (r) => {
        const on = monitoringMap[r.subdomain] ?? r.monitoring;
        return (
          <Toggle
            on={on}
            onChange={(v) => setMonitoringMap((m) => ({ ...m, [r.subdomain]: v }))}
          />
        );
      },
    },
    { key: "parent", header: "Parent Domain", render: (r) => <span className="text-[12px] text-slate-300">{r.parent}</span> },
    {
      key: "http",
      header: "HTTP",
      align: "center",
      render: (r) => (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold tabular-nums"
          style={{
            background: r.http === 200 ? "rgba(16,185,129,0.10)" : r.http === 404 ? "rgba(249,115,22,0.10)" : "rgba(148,163,184,0.10)",
            color: r.http === 200 ? "#6ee7b7" : r.http === 404 ? "#fdba74" : "#94a3b8",
            border: r.http === 200 ? "1px solid rgba(16,185,129,0.30)" : r.http === 404 ? "1px solid rgba(249,115,22,0.30)" : "1px solid rgba(148,163,184,0.30)",
          }}
        >
          {r.http}
        </span>
      ),
    },
    {
      key: "vulns",
      header: "Vulnerabilities",
      render: (r) => <SeverityCounters critical={r.critical} high={r.high} medium={r.medium} low={r.low} />,
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "discovered", header: "Discovered", render: (r) => <span className="text-[11px] text-slate-500">{r.discovered}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Asset Discovery"
        description="Central repository of automatically discovered subdomains and IPs. New surfaces are surfaced continuously via passive DNS, certificate transparency, and active probing."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Search} placeholder="Subdomain" />
          <FilterInput icon={Globe} placeholder="Parent Domain" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["ACTIVE", "INACTIVE", "RESOLVED", "UNKNOWN"]} />
          <FilterSelect label="HTTP Code" options={["200", "404", "0"]} />
        </div>
      </FilterCard>

      <DataTable<DiscoveryRow>
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
