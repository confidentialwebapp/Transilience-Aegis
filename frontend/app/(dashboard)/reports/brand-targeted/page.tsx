"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { MonthlyLineChart } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

const BRAND_TREND: Record<string, number[]> = {
  "Acme Bank": [1, 0, 1, 2, 1, 1, 0, 1, 4, 3, 2],
  "Globex Insurance": [0, 1, 0, 1, 0, 0, 1, 1, 2, 4, 3],
};

export default function BrandTargetedReport() {
  const brands = ["Acme Bank", "Globex Insurance"];
  return (
    <>
      <PageHeader
        title="Brand Targeted"
        description="Recent or historic data of all incidents summarised on brand level. Visualises how each monitored brand has been targeted over the last 12 months."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>
      <div className="space-y-4">
        {brands.map((b) => (
          <MonthlyLineChart
            key={b}
            title={`${b} — Last 12 months`}
            series={[{ name: "Incidents", data: BRAND_TREND[b], color: "#a855f7" }]}
            yMax={5}
          />
        ))}
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl mt-4"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <span className="text-[11px] text-slate-500">
          Showing <span className="text-slate-300 font-medium">1</span> to{" "}
          <span className="text-slate-300 font-medium">2</span> of{" "}
          <span className="text-slate-300 font-medium">2</span> entries
        </span>
      </div>
    </>
  );
}
