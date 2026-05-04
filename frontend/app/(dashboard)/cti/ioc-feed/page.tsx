"use client";

import { useState } from "react";
import { PageHeader, FilterCard, FilterInput, FilterSelect } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function IocFeedPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  return (
    <>
      <PageHeader
        title="IOC Feed"
        description="Every indicator of compromise discovered in the latest scan — URLs, domains, social handles, document URLs. Each row is a real artefact you can pivot on."
      />
      <FilterCard onSearch={() => {}} onReset={() => { setQ(""); setCategory(""); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FilterInput placeholder="Search indicator / title…" value={q} onChange={(e: any) => setQ(e.target.value)} />
          <FilterSelect label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)}
            options={["social_impersonation", "code_leak", "domain_abuse", "darkweb_exposure", "mobile_app_abuse"]} />
        </div>
      </FilterCard>
      <FindingsTable category={category || undefined} pageSize={100} />
    </>
  );
}
