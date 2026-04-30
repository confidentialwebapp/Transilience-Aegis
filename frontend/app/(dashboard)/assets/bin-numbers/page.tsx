"use client";

import { Plus, Banknote } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface BinRow {
  bin: string;
  scheme: "Visa" | "Mastercard" | "Amex" | "RuPay";
  type: "Debit" | "Credit" | "Prepaid";
  brand: string;
  status: "ACTIVE" | "INACTIVE";
}

const ROWS: BinRow[] = [
  { bin: "424242", scheme: "Visa", type: "Credit", brand: "Acme Bank", status: "ACTIVE" },
  { bin: "411111", scheme: "Visa", type: "Debit", brand: "Acme Bank", status: "ACTIVE" },
  { bin: "555555", scheme: "Mastercard", type: "Credit", brand: "Acme Bank", status: "ACTIVE" },
  { bin: "603489", scheme: "RuPay", type: "Debit", brand: "Globex Insurance", status: "ACTIVE" },
  { bin: "378282", scheme: "Amex", type: "Credit", brand: "Stark Retail", status: "INACTIVE" },
];

export default function BinNumbersPage() {
  const cols: Column<BinRow>[] = [
    {
      key: "bin",
      header: "BIN",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Banknote className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[12.5px] text-slate-200 font-mono font-semibold">{r.bin}******</span>
        </div>
      ),
    },
    {
      key: "scheme",
      header: "Scheme",
      render: (r) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "rgba(59,130,246,0.10)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.30)" }}>
          {r.scheme}
        </span>
      ),
    },
    { key: "type", header: "Type", render: (r) => <span className="text-[12px] text-slate-300">{r.type}</span> },
    { key: "brand", header: "Issuer", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="BIN Numbers"
        description="Card BIN registry. Lets DLR map leaked cardholder data back to your issuing entity for fast compromise scoping."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add BIN
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="BIN (first 6 digits)" />
          <FilterSelect label="Scheme" options={["Visa", "Mastercard", "Amex", "RuPay"]} />
          <FilterSelect label="Issuer" options={BRANDS} />
        </div>
      </FilterCard>
      <DataTable<BinRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
