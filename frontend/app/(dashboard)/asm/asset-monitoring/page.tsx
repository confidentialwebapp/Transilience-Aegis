"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function AssetMonitoringPage() {
  return (
    <>
      <PageHeader
        title="Asset Monitoring"
        description="Continuous posture for known CreditAccess Grameen infrastructure — services, certificates, exposed admin surfaces."
      />
      <FindingsTable
        module="infra_intel,pentest_recon,supply_chain"
        pageSize={50}
      />
    </>
  );
}
