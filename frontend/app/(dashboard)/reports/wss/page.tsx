"use client";

import { Calendar, FileSearch } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, KPICard, SeverityCounters } from "@/components/platform";
import { MonthlyBar, DonutBreakdown } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

export default function WssReport() {
  return (
    <>
      <PageHeader
        title="Website Scanning Suite Report"
        description="Cross-site WSS verdict and findings trend over the reporting window."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Verdict" options={["CLEAN", "POTENTIALLY SUSPICIOUS"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Total Scans" value={2814} accent="purple" icon={FileSearch} />
        <KPICard label="Clean" value={2412} accent="green" />
        <KPICard label="Suspicious" value={402} accent="amber" />
        <KPICard label="Critical Findings" value={38} accent="red" />
      </div>

      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">Findings severity</h3>
        <SeverityCounters critical={38} high={94} medium={186} low={284} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyBar
          title="Scans per month"
          series={[
            { name: "Clean", data: [180, 190, 200, 210, 220, 240, 250, 230, 260, 270, 280], color: "#10b981" },
            { name: "Suspicious", data: [20, 25, 30, 22, 28, 32, 36, 30, 40, 44, 48], color: "#f97316" },
          ]}
        />
        <DonutBreakdown
          title="Verdict mix"
          data={[
            { name: "Clean", value: 2412, color: "#10b981" },
            { name: "Potentially Suspicious", value: 402, color: "#f97316" },
          ]}
        />
      </div>
    </>
  );
}
