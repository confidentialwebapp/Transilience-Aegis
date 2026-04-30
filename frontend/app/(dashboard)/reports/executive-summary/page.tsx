"use client";

import { Calendar, ShieldX, Activity, KeyRound, Mail, Radar, CheckCircle, Download, FileBadge } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, KPICard } from "@/components/platform";
import { MonthlyLineChart, DonutBreakdown, CountryBarH } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

export default function ExecutiveSummaryReport() {
  return (
    <>
      <PageHeader
        title="Executive Summary"
        description="Single-page board-ready overview of incidents, exposure, takedown effectiveness, and overall security posture."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Download className="w-3 h-3" /> Export PDF
          </button>
        }
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KPICard label="Active Incidents" value={318} accent="red" icon={ShieldX} />
        <KPICard label="Cases Closed" value={1202} accent="green" icon={CheckCircle} />
        <KPICard label="Credentials Recovered" value={"24,134"} accent="blue" icon={KeyRound} />
        <KPICard label="DMARC Compliance" value="96.4%" accent="purple" icon={Mail} />
        <KPICard label="Surface Coverage" value="74%" accent="amber" icon={Radar} />
        <KPICard label="Avg TTD" value="08h 42m" accent="slate" icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <MonthlyLineChart
            title="Incidents over time"
            series={[
              { name: "Critical", data: [3, 4, 2, 3, 5, 6, 4, 5, 8, 9, 6], color: "#ef4444" },
              { name: "Substantial", data: [5, 6, 4, 5, 6, 7, 5, 6, 9, 11, 8], color: "#f97316" },
              { name: "Moderate", data: [8, 7, 9, 8, 10, 12, 9, 11, 14, 16, 13], color: "#eab308" },
            ]}
            yMax={20}
          />
        </div>
        <DonutBreakdown
          title="Incident type mix"
          data={[
            { name: "Phishing", value: 124, color: "#ef4444" },
            { name: "Brand Abuse", value: 98, color: "#a855f7" },
            { name: "Social Media", value: 72, color: "#ec4899" },
            { name: "Email", value: 24, color: "#3b82f6" },
          ]}
        />
      </div>

      <CountryBarH
        title="Top hosting countries"
        rows={[
          { name: "United States", count: 142 },
          { name: "Russia", count: 89 },
          { name: "China", count: 76 },
          { name: "Germany", count: 54 },
          { name: "Netherlands", count: 41 },
        ]}
      />
    </>
  );
}
