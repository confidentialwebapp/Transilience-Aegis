"use client";

import Link from "next/link";
import { Mail, ChevronRight } from "lucide-react";
import { PageHeader, KPICard } from "@/components/platform";

export default function DmarcDashboardEntrypoint() {
  return (
    <>
      <PageHeader
        title="DMARC Dashboard"
        description="Quick snapshot of DMARC compliance. Open the full DMARC MSS console for the complete view."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Total Volume (7d)" value="16,974" accent="purple" icon={Mail} />
        <KPICard label="DMARC Pass" value="14,820" accent="green" />
        <KPICard label="DMARC Quarantine" value="1,842" accent="amber" />
        <KPICard label="DMARC Reject" value="312" accent="red" />
      </div>
      <Link
        href="/dmarc"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
        style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
      >
        Open DMARC MSS <ChevronRight className="w-3 h-3" />
      </Link>
    </>
  );
}
