"use client";

import { Plus, Database } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface DnsDataRow {
  domain: string;
  recordType: string;
  value: string;
  ttl: number;
  brand: string;
}

const ROWS: DnsDataRow[] = [
  { domain: "acmebank.com", recordType: "A", value: "104.21.42.18", ttl: 300, brand: "Acme Bank" },
  { domain: "acmebank.com", recordType: "MX", value: "10 mail.acmebank.com", ttl: 3600, brand: "Acme Bank" },
  { domain: "acmebank.com", recordType: "TXT (SPF)", value: "v=spf1 include:_spf.acmebank.com -all", ttl: 3600, brand: "Acme Bank" },
  { domain: "acmebank.com", recordType: "TXT (DMARC)", value: "v=DMARC1; p=reject; rua=mailto:dmarc@acme.com", ttl: 3600, brand: "Acme Bank" },
  { domain: "globexinsurance.com", recordType: "A", value: "172.67.155.84", ttl: 300, brand: "Globex Insurance" },
  { domain: "globexinsurance.com", recordType: "TXT (SPF)", value: "v=spf1 ip4:18.244.0.0/16 -all", ttl: 3600, brand: "Globex Insurance" },
];

export default function DnsDataPage() {
  const cols: Column<DnsDataRow>[] = [
    {
      key: "domain",
      header: "Domain",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[12px] text-slate-200 font-semibold">{r.domain}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "rgba(168,85,247,0.10)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.30)" }}>
          {r.recordType}
        </span>
      ),
    },
    { key: "value", header: "Value", render: (r) => <span className="text-[11.5px] text-slate-300 font-mono break-all">{r.value}</span> },
    { key: "ttl", header: "TTL", align: "right", render: (r) => <span className="text-[12px] text-slate-400 tabular-nums">{r.ttl}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
  ];
  return (
    <>
      <PageHeader
        title="DNS Data"
        description="Authoritative DNS records for monitored domains. Drives DNS Monitoring drift detection."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Import Zone
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Domain" />
          <FilterSelect label="Record Type" options={["A", "AAAA", "CNAME", "MX", "TXT (SPF)", "TXT (DMARC)", "DKIM", "NS"]} />
          <FilterSelect label="Brand" options={BRANDS} />
        </div>
      </FilterCard>
      <DataTable<DnsDataRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
