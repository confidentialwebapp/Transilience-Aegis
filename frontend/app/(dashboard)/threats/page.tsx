"use client";

import { useState } from "react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function ThreatsPage() {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");

  return (
    <>
      <PageHeader
        title="Threat Feed"
        description="Every finding the BrandMonitoring engine has surfaced for CreditAccess Grameen — sortable by severity, filterable by category and module. This is the single live feed of brand-targeted activity."
      />
      <FilterCard onSearch={() => {}} onReset={() => { setQ(""); setSeverity(""); setCategory(""); }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Search title / indicator…" value={q} onChange={(e: any) => setQ(e.target.value)} />
          <FilterSelect label="Severity" value={severity} onChange={(e: any) => setSeverity(e.target.value)}
            options={["Critical", "High", "Substantial", "Medium", "Low", "Informational"]} />
          <FilterSelect label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)}
            options={["social_impersonation", "code_leak", "domain_abuse", "darkweb_exposure", "mobile_app_abuse"]} />
        </div>
      </FilterCard>
      <FindingsTable severity={severity || undefined} category={category || undefined} />
    </>
  );
}
