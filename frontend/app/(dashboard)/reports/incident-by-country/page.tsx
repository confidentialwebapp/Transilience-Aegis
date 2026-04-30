"use client";

import { Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { CountryBarH, DonutBreakdown } from "@/components/platform/ReportChart";
import { BRANDS } from "@/lib/mock-data";

export default function IncidentByCountryReport() {
  return (
    <>
      <PageHeader
        title="Incident By Host Country"
        description="Where the malicious infrastructure is hosted. Helps inform takedown partner selection and ISP escalation paths."
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Incident Type" options={["Phishing", "Fake Website", "Brand Abuse"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CountryBarH
          title="Top hosting countries (last 90d)"
          rows={[
            { name: "United States", count: 142 },
            { name: "Russia", count: 89 },
            { name: "China", count: 76 },
            { name: "Germany", count: 54 },
            { name: "Netherlands", count: 41 },
            { name: "United Kingdom", count: 35 },
            { name: "India", count: 29 },
            { name: "Brazil", count: 24 },
            { name: "Singapore", count: 18 },
            { name: "France", count: 12 },
          ]}
        />
        <DonutBreakdown
          title="Continent distribution"
          data={[
            { name: "North America", value: 178, color: "#a855f7" },
            { name: "Europe", value: 142, color: "#ec4899" },
            { name: "Asia", value: 124, color: "#3b82f6" },
            { name: "South America", value: 28, color: "#10b981" },
            { name: "Africa", value: 12, color: "#f59e0b" },
          ]}
        />
      </div>
    </>
  );
}
