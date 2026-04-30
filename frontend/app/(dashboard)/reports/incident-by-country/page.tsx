"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { GraphViewCard, PieWithLabels } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

interface CountryRow {
  country: string;
  count: number;
}

const ROWS: CountryRow[] = [
  { country: "United States of America", count: 18 },
  { country: "France",       count: 3 },
  { country: "Cyprus",       count: 1 },
  { country: "Germany",      count: 1 },
  { country: "South Africa", count: 1 },
  { country: "Ireland",      count: 1 },
];

const PIE_DATA = ROWS.map((r, i) => ({
  name: r.country,
  value: r.count,
  color: ["#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"][i % 6],
}));

export default function IncidentByCountryReport() {
  const cols: Column<CountryRow>[] = [
    { key: "country", header: "Country", render: (r) => <span className="text-[12.5px] font-semibold text-slate-200">{r.country}</span> },
    {
      key: "count",
      header: "Count",
      align: "right",
      render: (r) => <span className="text-[12px] text-purple-300 tabular-nums font-bold">{r.count}</span>,
    },
  ];
  return (
    <>
      <PageHeader
        title="Incident by Host Country"
        description="Recent or historic data of all incidents summarised on the webhost country — where the offending content is physically hosted."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Incident Type" options={["Phishing", "Social Media", "Brand Abuse"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <DataTable<CountryRow>
        columns={cols}
        rows={ROWS}
        totalEntries={ROWS.length}
        rowAction={false}
      />

      <div className="mt-4">
        <GraphViewCard title="Graph View" descriptor="Hosting country distribution">
          <PieWithLabels data={PIE_DATA} />
        </GraphViewCard>
      </div>
    </>
  );
}
