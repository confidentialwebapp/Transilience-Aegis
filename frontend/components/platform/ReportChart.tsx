"use client";

import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const months12 = ["Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26"];

/** Wrapper used by every Reports chart — title block + italic descriptor + chart card. */
export function GraphViewCard({
  title,
  descriptor,
  children,
}: {
  title?: string;
  descriptor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
        <h3 className="text-[12px] font-bold tracking-[0.13em] uppercase text-slate-400">
          {title ?? "Graph View"}
        </h3>
        {descriptor && <p className="text-[11.5px] italic text-slate-300 mt-0.5">{descriptor}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

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

/** Severity-bucket peak chart (single line over Critical/High/Substantial/Moderate/Low). */
export function SeverityLineChart({ data, max = 1 }: { data: number[]; max?: number }) {
  const labels = ["Critical", "High", "Substantial", "Moderate", "Low"];
  const series = labels.map((l, i) => ({ severity: l, count: data[i] ?? 0 }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
          <XAxis dataKey="severity" stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={10} domain={[0, max]} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#a855f7"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#a855f7", stroke: "#fff", strokeWidth: 1 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two stacked single-series line charts sharing the same x-axis. */
export function DualPanelLines({
  series,
  xLabels,
  yMax = 4,
}: {
  series: { name: string; data: number[]; color: string }[];
  xLabels: string[];
  yMax?: number;
}) {
  return (
    <div className="space-y-3">
      {series.map((s) => {
        const data = xLabels.map((m, i) => ({ x: m, [s.name]: s.data[i] ?? 0 }));
        return (
          <div key={s.name}>
            <p className="text-[11px] font-semibold text-slate-300 mb-1 px-1">{s.name}</p>
            <div className="h-40">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
                  <XAxis dataKey="x" stroke="#64748b" fontSize={9.5} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[0, yMax]} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Multi-series line chart with x-axis as incident types (rotated labels), used in Site Take Down Time. */
export function IncidentTypeChart({
  xLabels,
  series,
  yMax = 400,
}: {
  xLabels: string[];
  series: { name: string; data: number[]; color: string }[];
}) {
  const data = xLabels.map((x, i) => {
    const row: Record<string, string | number> = { x };
    for (const s of series) row[s.name] = s.data[i] ?? 0;
    return row;
  });
  void yMax;
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 28, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
          <XAxis dataKey="x" stroke="#64748b" fontSize={10} angle={-45} textAnchor="end" interval={0} height={70} />
          <YAxis stroke="#64748b" fontSize={10} />
          <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pie chart with external leader-line labels (used in Incident By Country). */
export function PieWithLabels({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const renderLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    name,
    value,
  }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    name?: string;
    value?: number;
  }) => {
    if (cx === undefined || cy === undefined || midAngle === undefined || outerRadius === undefined) return null;
    const RADIAN = Math.PI / 180;
    const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
    const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
    const mx = cx + (outerRadius + 16) * Math.cos(-midAngle * RADIAN);
    const my = cy + (outerRadius + 16) * Math.sin(-midAngle * RADIAN);
    const right = Math.cos(-midAngle * RADIAN) >= 0;
    const ex = mx + (right ? 1 : -1) * 28;
    const ey = my;
    return (
      <g>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#475569" fill="none" />
        <circle cx={ex} cy={ey} r={2} fill="#94a3b8" stroke="none" />
        <text
          x={ex + (right ? 4 : -4)}
          y={ey}
          fill="#cbd5e1"
          fontSize="10.5"
          textAnchor={right ? "start" : "end"}
          dominantBaseline="middle"
        >
          {`${name} (${value})`}
        </text>
      </g>
    );
  };

  return (
    <div className="h-72">
      <ResponsiveContainer>
        <PieChart margin={{ top: 24, right: 100, bottom: 24, left: 100 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={92}
            paddingAngle={1}
            stroke="#0d0a14"
            strokeWidth={2}
            label={renderLabel}
            labelLine={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
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
