"use client";

import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genDns, type DnsRow, BRANDS } from "@/lib/mock-data";

export default function DnsMonitoringPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 124;
  const rows = useMemo<DnsRow[]>(() => genDns(pageSize), []);

  const cols: Column<DnsRow>[] = [
    { key: "domain", header: "Domain", render: (r) => <span className="text-[12.5px] text-slate-200 font-semibold">{r.domain}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "ips",
      header: "IPs",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          {r.ips.map((ip) => (
            <span key={ip} className="text-[11px] text-slate-300 font-mono">{ip}</span>
          ))}
        </div>
      ),
    },
    {
      key: "ns",
      header: "Nameservers",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          {r.nameservers.map((ns) => (
            <span key={ns} className="text-[11px] text-slate-400 font-mono">{ns}</span>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.status === "Mismatched" ? (
          <div className="flex flex-col items-start gap-1">
            <StatusPill status="MISMATCHED" />
            <span className="text-[10px] text-red-400 font-mono">offending: {r.offendingIp}</span>
          </div>
        ) : (
          <StatusPill status="MATCHED" />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="DNS Monitoring"
        description="Detects mismatched IPs, nameserver changes, and DNS hijack attempts for your monitored domains. Alerts are raised when authoritative records drift from the approved baseline."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Domain" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["Matched", "Mismatched"]} />
        </div>
      </FilterCard>

      <DataTable<DnsRow>
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
