"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { MonthlyBar, DonutBreakdown } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

export default function ThreatOverTimeReport() {
  return (
    <>
      <PageHeader
        title="Threat Over Time"
        description="Aggregate count and severity mix of incidents across the entire monitored portfolio over time."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Severity" options={["Critical", "Substantial", "Moderate", "Low"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <MonthlyBar
          title="Threats by month and severity"
          series={[
            { name: "Critical", data: [3, 4, 2, 3, 5, 6, 4, 5, 8, 9, 6], color: "#ef4444" },
            { name: "Substantial", data: [5, 6, 4, 5, 6, 7, 5, 6, 9, 11, 8], color: "#f97316" },
            { name: "Moderate", data: [8, 7, 9, 8, 10, 12, 9, 11, 14, 16, 13], color: "#eab308" },
            { name: "Low", data: [12, 11, 14, 13, 15, 18, 14, 16, 19, 22, 18], color: "#10b981" },
          ]}
        />
        <DonutBreakdown
          title="Severity mix (last 30d)"
          data={[
            { name: "Critical", value: 24, color: "#ef4444" },
            { name: "Substantial", value: 38, color: "#f97316" },
            { name: "Moderate", value: 56, color: "#eab308" },
            { name: "Low", value: 102, color: "#10b981" },
          ]}
        />
      </div>
    </>
  );
}
