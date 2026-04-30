"use client";

import { useState } from "react";
import { Globe, Plus } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, Toggle } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface DomainAsset {
  domain: string;
  brand: string;
  registrar: string;
  expiry: string;
  monitoring: boolean;
  status: "ACTIVE" | "INACTIVE";
  added: string;
}

const ROWS: DomainAsset[] = [
  { domain: "acmebank.com", brand: "Acme Bank", registrar: "MarkMonitor", expiry: "12 Aug 2026", monitoring: true, status: "ACTIVE", added: "01 Jan 2024" },
  { domain: "globexinsurance.com", brand: "Globex Insurance", registrar: "GoDaddy", expiry: "04 Sep 2026", monitoring: true, status: "ACTIVE", added: "01 Jan 2024" },
  { domain: "initechtelecom.com", brand: "Initech Telecom", registrar: "Namecheap", expiry: "18 Mar 2026", monitoring: true, status: "ACTIVE", added: "01 Jan 2024" },
  { domain: "soylenthealth.com", brand: "Soylent Health", registrar: "MarkMonitor", expiry: "22 Nov 2026", monitoring: true, status: "ACTIVE", added: "12 Feb 2024" },
  { domain: "waynemfg.com", brand: "Wayne Manufacturing", registrar: "CSC", expiry: "05 Jun 2027", monitoring: false, status: "INACTIVE", added: "12 Feb 2024" },
  { domain: "starkretail.com", brand: "Stark Retail", registrar: "MarkMonitor", expiry: "30 Apr 2026", monitoring: true, status: "ACTIVE", added: "01 Apr 2024" },
];

export default function DomainsAssetsPage() {
  const [monitoringMap, setMonitoringMap] = useState<Record<string, boolean>>({});
  const cols: Column<DomainAsset>[] = [
    { key: "domain", header: "Domain", render: (r) => <span className="text-[12.5px] text-slate-200 font-semibold">{r.domain}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "registrar", header: "Registrar", render: (r) => <span className="text-[12px] text-slate-400">{r.registrar}</span> },
    { key: "expiry", header: "Expiry", render: (r) => <span className="text-[12px] text-slate-400">{r.expiry}</span> },
    {
      key: "monitoring",
      header: "Monitoring",
      render: (r) => {
        const on = monitoringMap[r.domain] ?? r.monitoring;
        return <Toggle on={on} onChange={(v) => setMonitoringMap((m) => ({ ...m, [r.domain]: v }))} />;
      },
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "added", header: "Added", render: (r) => <span className="text-[11px] text-slate-500">{r.added}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Domains"
        description="Authoritative list of brand-owned domains. Drives ASM, DNS Monitoring, and DMARC scope."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Domain
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Domain" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["ACTIVE", "INACTIVE"]} />
        </div>
      </FilterCard>
      <DataTable<DomainAsset> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
