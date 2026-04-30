"use client";

import { useMemo, useState } from "react";
import { Globe, Skull } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, TagGroup, TagPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genActors, type ActorRow, COUNTRIES } from "@/lib/mock-data";

export default function ThreatActorsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 7166;
  const rows = useMemo<ActorRow[]>(
    () => genActors(pageSize, (page - 1) * pageSize),
    [page]
  );

  const cols: Column<ActorRow>[] = [
    {
      key: "name",
      header: "Actor",
      render: (r) => (
        <div className="flex items-start gap-2.5 max-w-[400px]">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(236,72,153,0.10)", border: "1px solid rgba(236,72,153,0.30)" }}
          >
            <Skull className="w-4 h-4 text-pink-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-200">{r.name}</p>
            <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{r.description}</p>
          </div>
        </div>
      ),
    },
    { key: "country", header: "Country", render: (r) => <span className="text-[12px] text-slate-300">{r.country}</span> },
    {
      key: "type",
      header: "Type",
      render: (r) => <TagPill label={r.type} />,
    },
    {
      key: "caps",
      header: "Capabilities",
      render: (r) => <TagGroup tags={r.capabilities} max={4} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Threat Actors"
        description="List of individuals, groups, and state-sponsored crews observed in IOC matches, dark web leaks, and partner intel sharing."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput placeholder="Actor name / alias" />
          <FilterSelect icon={Globe} label="Country" options={[...COUNTRIES]} />
          <FilterSelect label="Type" options={["APT GROUPS", "CYBER CRIMINALS", "STATE SPONSORED HACKER"]} />
          <FilterSelect label="Capability" options={["CYBER ESPIONAGE", "DATA BREACHES", "MALWARE AND RANSOMWARE", "STOLEN CREDENTIALS", "0-DAY", "REMOTE ACCESS TROJAN"]} />
        </div>
      </FilterCard>

      <DataTable<ActorRow>
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
