"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform";
import { fetchReportBrandTargeted } from "@/lib/derived";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SEV_PALETTE: Record<string, string> = {
  Critical: "#ef4444", High: "#f97316", Substantial: "#f59e0b", Medium: "#eab308",
  Moderate: "#eab308", Low: "#3b82f6", Informational: "#64748b",
};

export default function BrandTargetedPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => { fetchReportBrandTargeted().then(setData).catch(() => {}); }, []);

  const cat = data ? Object.entries(data.by_category || {}).map(([k, v]) => ({ name: k, value: v as number })) : [];
  const sev = data ? Object.entries(data.by_severity || {}).map(([k, v]) => ({ name: k, value: v as number })) : [];

  return (
    <>
      <PageHeader
        title="Brands Targeted"
        description={`Volume and category breakdown of all findings against ${data?.brand || "the brand"} — ${data?.total_findings ?? 0} total signals across the latest BrandMonitoring scan window.`}
      />
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Findings by Category</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cat} margin={{ top: 10, right: 10, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Findings by Severity</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sev} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {sev.map((e, i) => <Cell key={i} fill={SEV_PALETTE[e.name] || "#64748b"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {sev.map((e) => (
              <span key={e.name} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px]"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: SEV_PALETTE[e.name] }} />
                <span className="text-slate-300">{e.name}</span>
                <span className="text-slate-500 font-mono">{e.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
