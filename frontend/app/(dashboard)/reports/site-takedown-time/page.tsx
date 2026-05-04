"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform";
import { fetchReportTakedownTime } from "@/lib/derived";

export default function TakedownTimePage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchReportTakedownTime().then(setData).catch(() => {}); }, []);

  return (
    <>
      <PageHeader
        title="Site Take Down Time"
        description="Mean / median / P95 takedown latency per registrar and hosting provider. Populated from real case-resolution timestamps once the takedown workflow runs against findings."
      />
      <div className="rounded-xl p-6" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[12px] text-slate-400">{data?.note || "Loading…"}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {["mean_hours", "median_hours", "p95_hours"].map((k) => (
            <div key={k} className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(139,92,246,0.1)" }}>
              <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">{k.replace("_", " ")}</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">{data?.stats?.[k] ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
