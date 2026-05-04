"use client";

import { useState } from "react";
import { PageHeader, FilterCard, FilterSelect, FilterInput } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function IncidentsPage() {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");

  return (
    <>
      <PageHeader
        title="Incidents (Site Take Down)"
        description="High-severity findings from the live BrandMonitoring scan against CreditAccess Grameen — phishing infra, brand-impersonating sites, fake apps. Each row is a candidate for takedown."
      />
      <FilterCard onSearch={() => {}} onReset={() => { setQ(""); setSeverity(""); setCategory(""); }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Search title / indicator…" value={q} onChange={(e: any) => setQ(e.target.value)} />
          <FilterSelect label="Severity" value={severity} onChange={(e: any) => setSeverity(e.target.value)}
            options={["Critical", "High", "Substantial", "Medium"]} />
          <FilterSelect label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)}
            options={["social_impersonation", "domain_abuse", "code_leak", "darkweb_exposure", "mobile_app_abuse"]} />
        </div>
      </FilterCard>

      <FindingsTable
        severity={severity || "Critical,High,Substantial,Medium"}
        category={category || undefined}
        emptyTitle="No incident-level findings in the latest scan"
        emptyDesc="High-severity items would appear here. Trigger a fresh scan from /asm/wss."
      />
    </>
  );
}
