"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/platform";
import { fetchReportThreatOverTime } from "@/lib/derived";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

export default function ThreatOverTimePage() {
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => { fetchReportThreatOverTime().then((j) => setTimeline(j.timeline || [])).catch(() => {}); }, []);

  const chartData = timeline.map((t) => ({
    date: t.date,
    total: t.count,
    Critical: t.by_severity?.Critical || 0,
    High: t.by_severity?.High || 0,
    Medium: (t.by_severity?.Medium || 0) + (t.by_severity?.Moderate || 0),
    Low: t.by_severity?.Low || 0,
    Informational: t.by_severity?.Informational || 0,
  }));

  return (
    <>
      <PageHeader
        title="Threats Over Time"
        description={`Time-series of detected findings, bucketed by ISO date. ${timeline.length} day(s) of history in the current scan corpus.`}
      />
      <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Total volume per day</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="total" stroke="#8b5cf6" fill="url(#vol)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Per-severity stack</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="Critical" stroke="#ef4444" />
            <Line dataKey="High" stroke="#f97316" />
            <Line dataKey="Medium" stroke="#eab308" />
            <Line dataKey="Low" stroke="#3b82f6" />
            <Line dataKey="Informational" stroke="#64748b" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
