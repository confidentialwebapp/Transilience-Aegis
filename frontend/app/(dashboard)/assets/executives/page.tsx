"use client";

import { Plus } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface ExecRow {
  name: string;
  title: string;
  company: string;
  email: string;
  vip: boolean;
}

const ROWS: ExecRow[] = [
  { name: "Karthik Raja", title: "CEO", company: "Transilience", email: "fde@transilienceai.com", vip: true },
  { name: "Priya Iyer", title: "CFO", company: "CreditAccessGrameen", email: "priya.iyer@creditaccessgrameen.com", vip: true },
  { name: "Rohit Mehta", title: "CISO", company: "CreditAccessGrameen", email: "rohit.mehta@creditaccessgrameen.com", vip: true },
  { name: "Anita Nair", title: "COO", company: "CreditAccessGrameen", email: "anita.nair@creditaccessgrameen.com", vip: false },
  { name: "Vikram Shah", title: "CTO", company: "CreditAccessGrameen", email: "vikram@creditaccessgrameen.com", vip: true },
];

export default function ExecutivesAssetsPage() {
  const cols: Column<ExecRow>[] = [
    {
      key: "name",
      header: "Executive",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
          >
            {r.name[0]}
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.name}</p>
            <p className="text-[10.5px] text-slate-500">{r.title}</p>
          </div>
        </div>
      ),
    },
    { key: "company", header: "Company", render: (r) => <span className="text-[12px] text-slate-300">{r.company}</span> },
    { key: "email", header: "Email", render: (r) => <span className="text-[12px] text-slate-400">{r.email}</span> },
    {
      key: "vip",
      header: "VIP",
      render: (r) => r.vip ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">VIP</span>
      ) : (
        <span className="text-[11px] text-slate-600">—</span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Executives"
        description="VIP roster monitored for impersonation, leaked credentials, and dark-web mentions. Adding an executive triggers continuous social and dark-web sweeps."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Executive
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Name / email" />
          <FilterSelect label="Company" options={BRANDS} />
          <FilterSelect label="VIP" options={["Yes", "No"]} />
        </div>
      </FilterCard>
      <DataTable<ExecRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
