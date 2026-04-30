"use client";

import { useState } from "react";
import { Calendar, Check, Package, FileText } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface ServiceItem {
  name: string;
  detail?: string;
}

const ACTIVE_SERVICES: ServiceItem[] = [
  { name: "MessagingSuite" },
  { name: "intelliCODE-copyiD" },
  { name: "Website Scanning Suite", detail: "Limit – 1" },
  { name: "Accessibility" },
  { name: "URL Scan Suite" },
  { name: "weblogic SaaS" },
  { name: "Incident Response" },
];

interface ContractRow {
  contractId: string;
  added: string;
  status: "EXPIRED" | "ACTIVE" | "PENDING";
  startDate: string;
  endDate: string;
  effectiveEnd: string;
  scope: string;
  productsCovered: string;
}

const CURRENT_CONTRACT: ContractRow[] = [
  {
    contractId: "TAI-CON-2026-0142",
    added: "12 Mar 2026 09:14:22",
    status: "ACTIVE",
    startDate: "01 Apr 2026",
    endDate: "31 Mar 2027",
    effectiveEnd: "30 Apr 2027",
    scope: "Full enterprise scope across monitored brand portfolio.",
    productsCovered:
      "Brand Monitoring, Social Media Monitoring, Mobile App Monitoring, Domain Monitoring, Dark Web Monitoring, MessagingSuite, URL Scan Suite, DNS Suite, intelliCODE-copyiD, weblogic SaaS, Website Scanning Suite (Limit – 1), Incident Response, Accessibility",
  },
];

const PRIOR_CONTRACTS: ContractRow[] = [
  {
    contractId: "N/A",
    added: "12 Mar 2024 11:02:18",
    status: "EXPIRED",
    startDate: "01 Apr 2024",
    endDate: "31 Mar 2025",
    effectiveEnd: "30 Apr 2025",
    scope: "N/A",
    productsCovered:
      "Brand Monitoring, Social Media Monitoring, Mobile App Monitoring, Domain Monitoring, Dark Web Monitoring, MessagingSuite, URL Scan Suite, DNS Suite, intelliCODE-copyiD, weblogic SaaS, Website Scanning Suite (Limit – 1), Incident Response, Accessibility",
  },
];

function ContractTable({ rows }: { rows: ContractRow[] }) {
  const cols: Column<ContractRow>[] = [
    {
      key: "id",
      header: "Contract ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">{r.contractId}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Added: {r.added}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "start",
      header: "Start Date",
      render: (r) => <span className="text-[12px] text-slate-300">{r.startDate}</span>,
    },
    {
      key: "end",
      header: "End Date",
      render: (r) => <span className="text-[12px] text-slate-300">{r.endDate}</span>,
    },
    {
      key: "eff",
      header: "Effective End Date",
      render: (r) => <span className="text-[12px] text-slate-300">{r.effectiveEnd}</span>,
    },
    {
      key: "scope",
      header: "Scope / Description",
      render: (r) => (
        <span className="text-[11.5px] text-slate-400 max-w-[260px] inline-block">{r.scope}</span>
      ),
    },
    {
      key: "products",
      header: "Products & Services Covered",
      render: (r) => (
        <span className="text-[11px] text-slate-300 leading-relaxed max-w-[420px] inline-block">
          {r.productsCovered}
        </span>
      ),
    },
  ];
  return (
    <DataTable<ContractRow>
      columns={cols}
      rows={rows}
      totalEntries={rows.length}
      rowAction={false}
    />
  );
}

export default function ServicesLicensePage() {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(
    Object.fromEntries(ACTIVE_SERVICES.map((s) => [s.name, true]))
  );

  return (
    <>
      <PageHeader
        title="Services (Subscription & License)"
        description="Services and subscription detail with full history. Active services drive feature visibility across the rest of the portal."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Client" options={BRANDS} />
          <FilterSelect label="Status" options={["ACTIVE", "EXPIRED", "PENDING"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      {/* Active Services panel */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <Package className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400">Active Services</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-4">
          {ACTIVE_SERVICES.map((s) => {
            const on = enabledMap[s.name];
            return (
              <button
                key={s.name}
                onClick={() => setEnabledMap((m) => ({ ...m, [s.name]: !on }))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:border-purple-500/30"
                style={{
                  background: on ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${on ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.10)"}`,
                }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: on ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "transparent",
                    border: `1.5px solid ${on ? "transparent" : "rgba(139,92,246,0.30)"}`,
                  }}
                >
                  {on && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-slate-200 truncate">{s.name}</p>
                  {s.detail && <p className="text-[10.5px] text-slate-500 truncate">{s.detail}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subscription History — Current */}
      <div className="mb-6">
        <h3 className="text-[13px] font-bold text-white mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-purple-300" />
          Current Contract
        </h3>
        <ContractTable rows={CURRENT_CONTRACT} />
        <div
          className="px-4 py-2 mt-2 text-[11px] text-slate-500 rounded-md"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.08)" }}
        >
          Showing 1 to {CURRENT_CONTRACT.length} of {CURRENT_CONTRACT.length} entries
        </div>
      </div>

      {/* Subscription History — Prior */}
      <div>
        <h3 className="text-[13px] font-bold text-white mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          Prior Contracts
        </h3>
        <ContractTable rows={PRIOR_CONTRACTS} />
        <div
          className="px-4 py-2 mt-2 text-[11px] text-slate-500 rounded-md"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.08)" }}
        >
          Showing 1 to {PRIOR_CONTRACTS.length} of {PRIOR_CONTRACTS.length} entries
        </div>
      </div>
    </>
  );
}
