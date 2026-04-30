"use client";

import { Plus, Smartphone } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface MobileAppRow {
  appName: string;
  bundle: string;
  store: "Apple App Store" | "Google Play" | "Other";
  brand: string;
  version: string;
  status: "ACTIVE" | "INACTIVE";
}

const ROWS: MobileAppRow[] = [
  { appName: "Acme Bank Mobile", bundle: "com.acmebank.mobile", store: "Apple App Store", brand: "Acme Bank", version: "12.4.1", status: "ACTIVE" },
  { appName: "Acme Bank Mobile", bundle: "com.acmebank.mobile", store: "Google Play", brand: "Acme Bank", version: "12.4.1", status: "ACTIVE" },
  { appName: "Globex Insurance", bundle: "com.globex.insure", store: "Apple App Store", brand: "Globex Insurance", version: "8.1.0", status: "ACTIVE" },
  { appName: "Initech Self-Care", bundle: "com.initech.selfcare", store: "Google Play", brand: "Initech Telecom", version: "6.2.3", status: "ACTIVE" },
  { appName: "Stark Retail", bundle: "com.stark.shop", store: "Apple App Store", brand: "Stark Retail", version: "4.0.2", status: "ACTIVE" },
];

export default function MobileAppsPage() {
  const cols: Column<MobileAppRow>[] = [
    {
      key: "name",
      header: "App",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.20), rgba(236,72,153,0.10))", border: "1px solid rgba(139,92,246,0.30)" }}>
            <Smartphone className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.appName}</p>
            <p className="text-[10.5px] text-slate-500 font-mono">{r.bundle}</p>
          </div>
        </div>
      ),
    },
    { key: "store", header: "Store", render: (r) => <span className="text-[12px] text-slate-300">{r.store}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
    { key: "version", header: "Version", render: (r) => <span className="text-[11.5px] text-slate-400 font-mono">{r.version}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="Mobile Apps"
        description="Authorised mobile applications. Drives store-level monitoring for fake clones, sideloads, and SDK supply-chain risk."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add App
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Bundle ID / name" />
          <FilterSelect label="Store" options={["Apple App Store", "Google Play", "Other"]} />
          <FilterSelect label="Brand" options={BRANDS} />
        </div>
      </FilterCard>
      <DataTable<MobileAppRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
