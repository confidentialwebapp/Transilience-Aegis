"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function AssetDiscoveryPage() {
  return (
    <>
      <PageHeader
        title="Asset Discovery"
        description="Unmanaged assets, lookalike domains, and infrastructure surfaced by the BrandMonitoring domain_intel + asset_discovery modules."
      />
      <FindingsTable
        module="domain_intel,asset_discovery,subdomain_takeover,cloud_exposure"
        pageSize={50}
      />
    </>
  );
}
