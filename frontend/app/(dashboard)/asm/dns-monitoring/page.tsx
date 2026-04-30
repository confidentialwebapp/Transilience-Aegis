"use client";

import { useMemo, useState } from "react";
import { Globe, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useFindings, useTenantId, type FindingRow } from "@/lib/realtime";
import { BRANDS } from "@/lib/mock-data";

interface DnsDisplay {
  domain: string;
  brand: string;
  ips: string[];
  nameservers: string[];
  status: "Matched" | "Mismatched";
  offendingIp?: string;
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

function toDisplay(r: FindingRow): DnsDisplay {
  const ev = (r.evidence ?? {}) as Record<string, unknown>;
  return {
    domain: (ev["domain"] as string) ?? r.url_or_value ?? "—",
    brand: (ev["brand"] as string) ?? "—",
    ips: asArray(ev["ips"]),
    nameservers: asArray(ev["nameservers"]),
    status: r.kind === "dns_mismatch" ? "Mismatched" : "Matched",
    offendingIp: ev["offending_ip"] as string | undefined,
  };
}

export default function DnsMonitoringPage() {
  const tenantId = useTenantId();
  const { data: findings, loading } = useFindings(tenantId);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const rows: DnsDisplay[] = useMemo(() => {
    return findings
      .filter((f) => f.source === "dns" || f.kind === "dns_mismatch" || f.kind === "dns_match")
      .map(toDisplay);
  }, [findings]);

  const total = rows.length;
  const startIdx = (page - 1) * pageSize;
  const visible = rows.slice(startIdx, startIdx + pageSize);

  const cols: Column<DnsDisplay>[] = [
    { key: "domain", header: "Domain", render: (r) => <span className="text-[12.5px] text-slate-200 font-semibold">{r.domain}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "ips",
      header: "IPs",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          {r.ips.length > 0 ? r.ips.map((ip) => (
            <span key={ip} className="text-[11px] text-slate-300 font-mono">{ip}</span>
          )) : <span className="text-[11px] text-slate-600">—</span>}
        </div>
      ),
    },
    {
      key: "ns",
      header: "Nameservers",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          {r.nameservers.length > 0 ? r.nameservers.map((ns) => (
            <span key={ns} className="text-[11px] text-slate-400 font-mono">{ns}</span>
          )) : <span className="text-[11px] text-slate-600">—</span>}
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
            {r.offendingIp && <span className="text-[10px] text-red-400 font-mono">offending: {r.offendingIp}</span>}
          </div>
        ) : (
          <StatusPill status="MATCHED" />
        ),
    },
  ];

  const livePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}
    >
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : `LIVE · ${total} CHECKS`}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
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

      <DataTable<DnsDisplay>
        columns={cols}
        rows={visible}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        emptyText={loading ? "Loading…" : "No data available."}
      />
    </>
  );
}
