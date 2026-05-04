"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function ExposurePage() {
  return (
    <>
      <PageHeader
        title="Exposure"
        description="Aggregate exposure surface: dark-web, code leaks, document leaks. Real findings from the latest BrandMonitoring scan."
      />
      <FindingsTable category="darkweb_exposure,code_leak" pageSize={50} />
    </>
  );
}
