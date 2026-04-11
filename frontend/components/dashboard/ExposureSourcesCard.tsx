"use client";

import { Eye, UserX, AlertTriangle } from "lucide-react";

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
  totalMentions: number;
  suspects: number;
  incidents: number;
  byModule: Record<string, number>;
}

export function ExposureSourcesCard({ totalMentions, suspects, incidents, byModule }: Props) {
  const total = Object.values(byModule).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Exposure Sources
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Eye className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalMentions.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Total Mentions</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <UserX className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{suspects.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Suspects</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{incidents.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Incidents</div>
          </div>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-800">
        {Object.entries(byModule).map(([module, count]) => (
          <div
            key={module}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: MODULE_COLORS[module] || "#6b7280",
            }}
            title={`${MODULE_LABELS[module] || module}: ${count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {Object.entries(byModule).map(([module, count]) => (
          <div key={module} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: MODULE_COLORS[module] || "#6b7280" }}
            />
            {MODULE_LABELS[module] || module}: {count}
          </div>
        ))}
      </div>
    </div>
  );
}
