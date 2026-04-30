"use client";

import { useMemo, useState } from "react";
import { Hash, Calendar, Search } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genIoc, type IocRow } from "@/lib/mock-data";

export default function IocFeedPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 4350667;
  const rows = useMemo<IocRow[]>(
    () => genIoc(pageSize, (page - 1) * pageSize),
    [page]
  );

  const cols: Column<IocRow>[] = [
    {
      key: "indicator",
      header: "Indicator",
      render: (r) => (
        <span className="text-[11.5px] font-mono text-slate-200 break-all">
          {r.indicator.length > 64 ? r.indicator.slice(0, 60) + "…" : r.indicator}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "rgba(168,85,247,0.10)",
            color: "#d8b4fe",
            border: "1px solid rgba(168,85,247,0.30)",
          }}
        >
          {r.type}
        </span>
      ),
    },
    { key: "first", header: "First Seen", render: (r) => <span className="text-[11px] text-slate-400">{r.firstSeen}</span> },
    { key: "expiry", header: "Expiry", render: (r) => <span className="text-[11px] text-slate-400">{r.expiry}</span> },
    {
      key: "confidence",
      header: "Confidence",
      align: "right",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 min-w-[60px]">
          <span className="text-[12px] font-bold text-purple-300 tabular-nums">{r.confidence}</span>
          <div className="w-14 h-1 rounded-full bg-purple-500/10 overflow-hidden">
            <div className="h-full rounded-full bg-purple-400" style={{ width: `${r.confidence}%` }} />
          </div>
        </div>
      ),
    },
    { key: "tags", header: "Tags", render: () => <span className="text-[11px] text-slate-600 italic">n/a</span> },
    { key: "source", header: "Source", render: () => <span className="text-[11px] text-slate-600 italic">n/a</span> },
  ];

  return (
    <>
      <PageHeader
        title="IOC Feed"
        description="Indicators of Compromise about active and emerging threats. Hashes, domains, IPs and URLs surfaced from sandboxed detonation, OSINT collection, and partner sharing."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Search} placeholder="Indicator value" />
          <FilterSelect label="Type" options={["filehash-md5", "filehash-sha1", "filehash-sha256", "domain", "url", "ip"]} />
          <FilterInput icon={Calendar} placeholder="Added After (YYYY-MM-DD)" />
          <FilterInput icon={Hash} placeholder="Min Confidence" />
        </div>
      </FilterCard>

      <DataTable<IocRow>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
      />
    </>
  );
}
