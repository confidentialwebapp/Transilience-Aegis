"use client";

import { useState } from "react";
import { PageHeader, FilterCard, FilterSelect, FilterInput } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function MonitoringPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  return (
    <>
      <PageHeader
        title="Monitoring (Low Threat Alerts)"
        description="Lower-confidence signals from the live BrandMonitoring scan — broad social mentions, low-risk SERP results, informational document references. Periodic review cadence."
      />
      <FilterCard onSearch={() => {}} onReset={() => { setQ(""); setCategory(""); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FilterInput placeholder="Search title / indicator…" value={q} onChange={(e: any) => setQ(e.target.value)} />
          <FilterSelect label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)}
            options={["social_impersonation", "code_leak", "domain_abuse", "darkweb_exposure"]} />
        </div>
      </FilterCard>

      <FindingsTable
        severity="Low,Informational"
        category={category || undefined}
        pageSize={50}
      />
    </>
  );
}
