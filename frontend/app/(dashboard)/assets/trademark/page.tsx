"use client";

import { Plus, FileBadge } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface TrademarkRow {
  reg: string;
  mark: string;
  brand: string;
  jurisdiction: string;
  classes: string;
  filed: string;
  status: "ACTIVE" | "PENDING";
}

const ROWS: TrademarkRow[] = [
  { reg: "TM-US-7281019", mark: "CREDITACCESS GRAMEEN", brand: "CreditAccessGrameen", jurisdiction: "USA", classes: "9, 36", filed: "12 Apr 2018", status: "ACTIVE" },
  { reg: "TM-EU-018412004", mark: "CREDITACCESS", brand: "CreditAccessGrameen", jurisdiction: "EU", classes: "36", filed: "04 Sep 2019", status: "ACTIVE" },
  { reg: "TM-IN-4218023", mark: "CREDITACCESS", brand: "CreditAccessGrameen", jurisdiction: "India", classes: "38, 42", filed: "18 Mar 2020", status: "ACTIVE" },
  { reg: "TM-IN-5028311", mark: "CREDITACCESS", brand: "CreditAccessGrameen", jurisdiction: "India", classes: "35", filed: "01 Apr 2024", status: "PENDING" },
];

export default function TrademarkPage() {
  const cols: Column<TrademarkRow>[] = [
    {
      key: "mark",
      header: "Mark",
      render: (r) => (
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
            <FileBadge className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.mark}</p>
            <p className="text-[10.5px] text-slate-500 font-mono">{r.reg}</p>
          </div>
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "jurisdiction", header: "Jurisdiction", render: (r) => <span className="text-[12px] text-slate-400">{r.jurisdiction}</span> },
    { key: "classes", header: "Classes", render: (r) => <span className="text-[12px] text-slate-400 font-mono">{r.classes}</span> },
    { key: "filed", header: "Filed", render: (r) => <span className="text-[11px] text-slate-500">{r.filed}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="Trademark Documents"
        description="Registered marks across jurisdictions. Used in legal escalations and registrar abuse complaints."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Upload
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Mark / registration #" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Jurisdiction" options={["USA", "EU", "UK", "India", "Singapore", "WIPO"]} />
        </div>
      </FilterCard>
      <DataTable<TrademarkRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
