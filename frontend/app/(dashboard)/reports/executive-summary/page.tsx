"use client";

import { useMemo, useState } from "react";
import { Calendar, FileBadge, Download } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, Pagination } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface LedgerRow {
  title: string;
  generatedAt: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function makeReports(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  // 227 entries — produced monthly per brand for the last ~24 months
  for (let i = 0; i < 227; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const monthIdx = i % 12;
    const yearOffset = Math.floor(i / 12) % 3; // covers 2024, 2025, 2026
    const year = 2026 - yearOffset;
    const monthName = MONTHS[monthIdx];
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    const seedHour = (i * 13) % 12;
    const seedMin = (i * 17) % 60;
    const seedSec = (i * 29) % 60;
    const ts = `${(monthIdx + 1).toString().padStart(2, "0")}/${lastDay}/${year} ${seedHour.toString().padStart(2, "0")}:${seedMin.toString().padStart(2, "0")}:${seedSec.toString().padStart(2, "0")} AM`;
    rows.push({
      title: `${brand} - Executive Summary Report - ${monthName} 1 ${year} to ${monthName} ${lastDay} ${year}`,
      generatedAt: ts,
    });
  }
  return rows;
}

const ALL = makeReports();

export default function ExecutiveSummaryReport() {
  const [page, setPage] = useState(1);
  const perPage = 50;
  const totalPages = Math.ceil(ALL.length / perPage);
  const visible = useMemo(() => ALL.slice((page - 1) * perPage, page * perPage), [page]);

  return (
    <>
      <PageHeader
        title="Executive Summary Report"
        description="Complete summary report of all major services (Incident, Monitoring, Darkweb, WSS, etc.) — generated monthly per brand. The library of every executive summary ever produced for this tenant."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Year" options={["2026", "2025", "2024"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="px-4 py-2.5 border-b grid grid-cols-[1fr_240px]" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400">Report Title</span>
          <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400 text-right">Generated</span>
        </div>
        <div className="divide-y divide-purple-500/[0.05]">
          {visible.map((r, i) => (
            <button
              key={`${page}-${i}`}
              className="w-full grid grid-cols-[1fr_240px] items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.25)" }}
                >
                  <FileBadge className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <span className="text-[12.5px] text-slate-200 group-hover:text-purple-200 truncate">{r.title}</span>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">{r.generatedAt}</span>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-300" />
              </div>
            </button>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: "rgba(139,92,246,0.10)", background: "rgba(255,255,255,0.015)" }}
        >
          <span className="text-[11px] text-slate-500">
            Showing <span className="text-slate-300 font-medium">{(page - 1) * perPage + 1}</span> to{" "}
            <span className="text-slate-300 font-medium">{Math.min(page * perPage, ALL.length)}</span> of{" "}
            <span className="text-slate-300 font-medium">{ALL.length}</span> entries
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </>
  );
}
