"use client";

import { Plus, FileCheck } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface ContentRow {
  title: string;
  type: string;
  brand: string;
  url: string;
  added: string;
  status: "ACTIVE" | "INACTIVE";
}

const ROWS: ContentRow[] = [
  { title: "Annual Report 2025", type: "PDF", brand: "CreditAccessGrameen", url: "creditaccessgrameen.com/annual-report-2025.pdf", added: "12 Mar 2026", status: "ACTIVE" },
  { title: "Brand Guidelines v3", type: "PDF", brand: "CreditAccessGrameen", url: "creditaccessgrameen.com/brand-guidelines.pdf", added: "01 Feb 2026", status: "ACTIVE" },
  { title: "Customer Charter", type: "Web Page", brand: "CreditAccessGrameen", url: "creditaccessgrameen.com/charter", added: "20 Jan 2026", status: "ACTIVE" },
  { title: "Press Release Q1 2026", type: "Web Page", brand: "CreditAccessGrameen", url: "creditaccessgrameen.com/news/q1-2026", added: "06 Apr 2026", status: "ACTIVE" },
];

export default function AuthorisedContentPage() {
  const cols: Column<ContentRow>[] = [
    {
      key: "title",
      header: "Content",
      render: (r) => (
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
            <FileCheck className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.title}</p>
            <p className="text-[10.5px] text-purple-300/80">{r.url}</p>
          </div>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (r) => <span className="text-[12px] text-slate-300">{r.type}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
    { key: "added", header: "Added", render: (r) => <span className="text-[11px] text-slate-500">{r.added}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="Authorised Contents"
        description="Verified content artefacts (PDFs, press pages, official docs). Used to authenticate first-party material against impersonation."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Content
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Title / URL" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Type" options={["PDF", "Web Page", "Image", "Video"]} />
        </div>
      </FilterCard>
      <DataTable<ContentRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
