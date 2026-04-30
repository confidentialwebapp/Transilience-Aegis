"use client";

import Link from "next/link";
import { CheckCircle, Clock, AlertCircle, XCircle, ShieldOff, ChevronRight } from "lucide-react";
import { PageHeader, KPICard } from "@/components/platform";
import { DonutBreakdown } from "@/components/platform/ReportChart";

export default function DlrDashboardEntrypoint() {
  return (
    <>
      <PageHeader
        title="Data Loss Recovery Dashboard"
        description="Snapshot of credentials and PII recovered from the dark web on your behalf."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KPICard label="Recovered" value={24134} accent="green" icon={CheckCircle} />
        <KPICard label="Waiting (CRR)" value={184} accent="amber" icon={Clock} />
        <KPICard label="Open" value={0} accent="slate" icon={AlertCircle} />
        <KPICard label="Recovery Failed" value={19} accent="red" icon={XCircle} />
        <KPICard label="Not Authorised" value={43} accent="purple" icon={ShieldOff} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <DonutBreakdown
          title="Recovery type mix"
          data={[
            { name: "Login Credentials", value: 14820, color: "#a855f7" },
            { name: "PII", value: 6280, color: "#ec4899" },
            { name: "Technical Info", value: 3034, color: "#3b82f6" },
          ]}
        />
        <DonutBreakdown
          title="Severity"
          data={[
            { name: "High", value: 5184, color: "#ef4444" },
            { name: "Moderate", value: 12810, color: "#f97316" },
            { name: "Low", value: 6140, color: "#10b981" },
          ]}
        />
      </div>

      <Link
        href="/threat-management/data-loss-recovery"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
        style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
      >
        Open Data Loss Recovery <ChevronRight className="w-3 h-3" />
      </Link>
    </>
  );
}
