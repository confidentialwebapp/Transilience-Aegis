"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function CredentialsPage() {
  return (
    <>
      <PageHeader
        title="Credentials"
        description="Email exposure, breach matches, and credential-leak findings. Powered by HIBP + IntelX + dark-web modules of the BrandMonitoring engine."
      />
      <FindingsTable
        module="email_exposure,darkweb_intel,stealer_logs"
        pageSize={50}
        emptyTitle="No credential exposure detected"
        emptyDesc="Run an email_exposure module pass with HIBP + Holehe enabled to populate this view."
      />
    </>
  );
}
