"use client";

import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const months12 = ["Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26"];

export function MonthlyLineChart({
  series,
  title,
  yMax = 4,
}: {
  series: { name: string; data: number[]; color: string }[];
  title?: string;
  yMax?: number;
}) {
  const data = months12.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    for (const s of series) row[s.name] = s.data[i] ?? 0;
    return row;
  });
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      {title && <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">{title}</h3>}
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} domain={[0, yMax]} />
            <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonthlyBar({ series, title }: { series: { name: string; data: number[]; color: string }[]; title?: string }) {
  const data = months12.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    for (const s of series) row[s.name] = s.data[i] ?? 0;
    return row;
  });
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      {title && <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">{title}</h3>}
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Bar key={s.name} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CountryBarH({ rows, title }: { rows: { name: string; count: number }[]; title?: string }) {
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      {title && <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">{title}</h3>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between text-[11.5px] text-slate-300">
              <span>{r.name}</span>
              <span className="tabular-nums font-bold text-purple-300">{r.count}</span>
            </div>
            <div className="h-2 rounded-full bg-purple-500/10 overflow-hidden mt-1">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.count / max) * 100}%`,
                  background: "linear-gradient(90deg,#8b5cf6,#ec4899)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutBreakdown({ data, title, total }: { data: { name: string; value: number; color: string }[]; title?: string; total?: string }) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      {title && <h3 className="text-[13px] font-bold text-white tracking-tight mb-3">{title}</h3>}
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 relative">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] uppercase tracking-wider text-slate-500">Total</span>
            <span className="text-[15px] font-bold text-white tabular-nums">{total ?? sum.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 text-slate-300">{d.name}</span>
              <span className="tabular-nums text-slate-200 font-medium">{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
