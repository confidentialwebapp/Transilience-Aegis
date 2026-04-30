"use client";

import { useMemo, useState } from "react";
import { Globe, Calendar, Download, HelpCircle } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, TagPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genTor, type TorRow, COUNTRIES } from "@/lib/mock-data";

export default function TorNodesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 2346;
  const rows = useMemo<TorRow[]>(() => genTor(pageSize), []);

  const cols: Column<TorRow>[] = [
    { key: "relay", header: "Relay Node", render: (r) => <span className="text-[11.5px] font-mono text-slate-200">{r.relay}</span> },
    {
      key: "exit",
      header: "Exit Node",
      render: (r) => r.exit ? <span className="text-[11.5px] font-mono text-amber-300">{r.exit}</span> : <span className="text-[11px] text-slate-600">—</span>,
    },
    { key: "name", header: "Name", render: (r) => <span className="text-[11.5px] text-slate-300">{r.name}</span> },
    {
      key: "flags",
      header: "Flags",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.flags.map((f) => (
            <TagPill key={f} label={f} />
          ))}
        </div>
      ),
    },
    { key: "country", header: "Country", render: (r) => <span className="text-[12px] text-slate-300">{r.country}</span> },
    { key: "first", header: "First Seen (UTC)", render: (r) => <span className="text-[11px] text-slate-400">{r.firstSeen}</span> },
  ];

  return (
    <>
      <PageHeader
        title="TOR Nodes"
        description="Continuously updated list of known TOR network relay and exit nodes. Useful for blocking, deception, or risk-scoring inbound connections."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }} title="Download node list">
            <Download className="w-3 h-3" /> Download
            <HelpCircle className="w-3 h-3 opacity-60" />
          </button>
        }
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterInput icon={Globe} placeholder="Node IP / name" />
          <FilterSelect label="Node Type" options={["Full Node", "Exit Node", "Guard", "HSDir"]} />
          <FilterInput icon={Calendar} placeholder="From Date" />
          <FilterInput icon={Calendar} placeholder="To Date" />
        </div>
      </FilterCard>

      <DataTable<TorRow>
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
