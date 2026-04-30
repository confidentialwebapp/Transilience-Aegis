"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { GraphViewCard, SeverityLineChart, DualPanelLines } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

const MONTHS_12 = [
  "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25",
  "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26",
];

export default function ThreatOverTimeReport() {
  return (
    <>
      <PageHeader
        title="Threats Over Time"
        description="Recent or historic data of all incidents summarised on threat level. View severity concentration and 12-month trends per series."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Severity" options={["Critical", "High", "Substantial", "Moderate", "Low"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div className="space-y-4">
        <GraphViewCard
          title="Graph View"
          descriptor="Threats of each brand in selected date range"
        >
          {/* Severity peak — Critical · High · Substantial · Moderate · Low; peaks at Substantial */}
          <SeverityLineChart data={[0, 0, 1, 0, 0]} max={1} />
        </GraphViewCard>

        <GraphViewCard
          title="Graph View"
          descriptor="Threats over the time of past 12 months"
        >
          <DualPanelLines
            xLabels={MONTHS_12}
            yMax={4}
            series={[
              { name: "Acme Bank",        data: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 4, 1], color: "#f97316" },
              { name: "Globex Insurance", data: [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 2], color: "#ef4444" },
            ]}
          />
        </GraphViewCard>
      </div>
    </>
  );
}
