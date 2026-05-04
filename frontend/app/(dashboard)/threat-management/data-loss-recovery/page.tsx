"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function DataLossRecoveryPage() {
  return (
    <>
      <PageHeader
        title="Data Loss Recovery"
        description="Code leaks, document leaks, and dark-web mentions of CreditAccess Grameen content — surface for legal-notice + takedown workflows."
      />
      <FindingsTable
        category="code_leak,darkweb_exposure"
        pageSize={50}
      />
    </>
  );
}
