"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function DarkWebPage() {
  return (
    <>
      <PageHeader
        title="Dark Web Monitor"
        description="Dark-web mentions, paste-site exposure, and document leaks referencing CreditAccess Grameen. Sourced from IntelX + ransomware-leak feeds + paste / document scrapers."
      />
      <FindingsTable category="darkweb_exposure" pageSize={50} />
    </>
  );
}
