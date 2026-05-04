"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform";
import { fetchReportMoved } from "@/lib/derived";

export default function MovedCasesPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchReportMoved().then(setData).catch(() => {}); }, []);

  return (
    <>
      <PageHeader
        title="Moved Cases"
        description="Cases reassigned between buckets / analysts / queues — useful for spotting routing bottlenecks."
      />
      <div className="rounded-xl p-6" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[12px] text-slate-400">{data?.note || "Loading…"}</p>
      </div>
    </>
  );
}
