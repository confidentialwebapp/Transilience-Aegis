"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, Pagination } from "@/components/platform";
import { GraphViewCard } from "@/components/platform/ReportChart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BRANDS } from "@/lib/mock-data";

const MONTHS_12 = [
  "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25",
  "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26",
];

// Per-brand 12-month incident counts. Flat at 0 from Jun → Nov, ramps Dec → Mar peak, tapers Apr.
const BRAND_TREND: Record<string, number[]> = {
  "Acme Bank":            [0, 0, 0, 0, 0, 0, 1, 1, 2, 4, 1],
  "Globex Insurance":     [0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 2],
  "Initech Telecom":      [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 1],
  "Soylent Health":       [0, 0, 0, 0, 0, 0, 1, 0, 2, 3, 2],
  "Wayne Manufacturing":  [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1],
  "Stark Retail":         [0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 2],
  "Umbrella Pharma":      [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1],
  "Pied Piper Gaming":    [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1],
};

function BrandLine({ name, data }: { name: string; data: number[] }) {
  const series = MONTHS_12.map((m, i) => ({ month: m, [name]: data[i] ?? 0 }));
  return (
    <div className="rounded-lg p-3"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.08)" }}>
      <p className="text-[12px] font-semibold text-slate-200 mb-2">{name}</p>
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} domain={[0, 4]} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#110d1a",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey={name}
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ r: 3, fill: "#a855f7" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function BrandTargetedReport() {
  const [page, setPage] = useState(1);
  const perPage = 2; // matches the spec's "Showing 1 to 2 of 2 entries" — we paginate brands, not rows
  const total = BRANDS.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const visible = BRANDS.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <PageHeader
        title="Brands Targeted"
        description="Recent or historic data of all incidents summarised on brand level. One trendline per brand, paginated."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <span className="text-[11px] text-slate-500">
          Showing <span className="text-slate-300 font-medium">{(page - 1) * perPage + 1}</span> to{" "}
          <span className="text-slate-300 font-medium">{Math.min(page * perPage, total)}</span> of{" "}
          <span className="text-slate-300 font-medium">{total}</span> entries
        </span>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <GraphViewCard title="Graph View" descriptor="Last 12 months">
        <div className="space-y-3">
          {visible.map((b) => (
            <BrandLine key={b} name={b} data={BRAND_TREND[b] ?? Array(11).fill(0)} />
          ))}
        </div>
      </GraphViewCard>
    </>
  );
}
