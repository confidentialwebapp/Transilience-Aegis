"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform";
import { fetchReportReopened } from "@/lib/derived";

export default function ReopenedReportPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchReportReopened().then(setData).catch(() => {}); }, []);

  return (
    <>
      <PageHeader
        title="Incidents Reopened"
        description="Cases that were closed and later reopened — strong signal of incomplete remediation. Populated when an analyst reopens a previously-closed case."
      />
      <div className="rounded-xl p-6" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[12px] text-slate-400">{data?.note || "Loading…"}</p>
      </div>
    </>
  );
}
