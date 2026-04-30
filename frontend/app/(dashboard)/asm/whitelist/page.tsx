"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genBrands, type BrandRow } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "brands", label: "Brands" },
  { key: "domains", label: "Domains" },
  { key: "subdomains", label: "Subdomains" },
  { key: "mobile", label: "Mobile Apps" },
  { key: "social", label: "Social Profiles" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function WhitelistPage() {
  const [tab, setTab] = useState<Tab>("brands");
  const brands = genBrands();

  const cols: Column<BrandRow>[] = [
    { key: "name", header: "Brand Name", render: (r) => <span className="text-[12.5px] font-semibold text-slate-200">{r.name}</span> },
    { key: "client", header: "Client", render: (r) => <span className="text-[12px] text-slate-400">{r.client}</span> },
    {
      key: "logo",
      header: "Logo",
      render: (r) => (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}>
          {r.name[0]}
        </div>
      ),
    },
    { key: "country", header: "Country", render: (r) => <span className="text-[12px] text-slate-400">{r.country}</span> },
    {
      key: "monitoring",
      header: "Brand Monitoring",
      render: (r) =>
        r.monitoring ? (
          <span className="text-[11.5px] font-bold text-emerald-400 tracking-wider">YES</span>
        ) : (
          <Link href="#" className="text-[11px] font-bold text-purple-300 hover:text-purple-200 underline">
            Request Monitoring
          </Link>
        ),
    },
    { key: "added", header: "Added Date", render: (r) => <span className="text-[12px] text-slate-400">{r.added}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Whitelist Management"
        description="Central repository of client-approved, brand-safe whitelisted assets. Whitelisted entries are excluded from auto-takedown workflows."
      />

      <div
        className="flex items-center gap-1 mb-4 p-1 rounded-lg w-fit overflow-x-auto"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all whitespace-nowrap",
              tab === t.key ? "text-white" : "text-slate-400 hover:text-white"
            )}
            style={tab === t.key ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "brands" && (
        <DataTable<BrandRow>
          columns={cols}
          rows={brands}
          totalEntries={brands.length}
          pageSize={brands.length}
          page={1}
          rowAction={false}
        />
      )}
      {tab !== "brands" && (
        <DataTable<BrandRow>
          columns={cols}
          rows={[]}
          emptyText="No data available."
        />
      )}
    </>
  );
}
