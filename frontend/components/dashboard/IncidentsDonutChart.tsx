"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MODULE_COLORS: Record<string, string> = {
  dark_web: "#a855f7",
  brand: "#f97316",
  data_leak: "#eab308",
  surface_web: "#3b82f6",
  credential: "#ef4444",
  cert_monitor: "#06b6d4",
};

const MODULE_LABELS: Record<string, string> = {
  dark_web: "Dark Web",
  brand: "Brand",
  data_leak: "Data Leak",
  surface_web: "Surface Web",
  credential: "Credentials",
  cert_monitor: "Certificates",
};

interface Props {
  data: Record<string, number>;
  total: number;
}

export function IncidentsDonutChart({ data, total }: Props) {
  const chartData = Object.entries(data || {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: MODULE_LABELS[key] || key,
      value,
      color: MODULE_COLORS[key] || "#6b7280",
    }));

  const hasData = chartData.length > 0;

  // Show a proper empty state instead of crashing recharts
  if (!hasData) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Incidents by Module
        </h2>
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="text-2xl font-bold text-slate-500 mb-1">0</div>
          <div className="text-xs text-slate-500">No incidents detected</div>
          <p className="text-xs text-slate-600 mt-3 max-w-[200px]">
            Run scans to start detecting threats across your monitored assets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Incidents by Module
      </h2>

      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid rgba(51,65,85,0.5)",
                borderRadius: "8px",
                color: "#f1f5f9",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-slate-400">Incidents</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 truncate">{entry.name}</span>
            <span className="ml-auto font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
