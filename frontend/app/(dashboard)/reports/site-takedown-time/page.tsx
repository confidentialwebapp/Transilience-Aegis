"use client";

import { Calendar, Clock, Zap, AlertTriangle } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, KPICard } from "@/components/platform";
import { MonthlyBar } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

export default function SiteTakedownTimeReport() {
  return (
    <>
      <PageHeader
        title="Site Take Down Time"
        description="Time-to-takedown metrics across phishing, fake-website, and brand-abuse cases. Lower is better."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Incident Type" options={["Phishing", "Fake Website", "Brand Abuse"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Avg Takedown Time" value="08h 42m" accent="green" icon={Clock} />
        <KPICard label="Fastest Takedown" value="00h 14m" accent="purple" icon={Zap} />
        <KPICard label="Slowest Takedown" value="72h 03m" accent="red" icon={AlertTriangle} />
        <KPICard label="Cases Closed (30d)" value={384} accent="blue" />
      </div>

      <MonthlyBar
        title="Avg takedown hours per month"
        series={[
          { name: "Avg hours", data: [12, 11, 13, 10, 9, 9, 8, 9, 8, 7, 8], color: "#a855f7" },
        ]}
      />
    </>
  );
}
