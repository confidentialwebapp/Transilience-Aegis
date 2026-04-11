"use client";

interface Props {
  filters: {
    severity: string;
    module: string;
    status: string;
  };
  onChange: (filters: { severity: string; module: string; status: string }) => void;
}

const SELECT_CLASS =
  "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500";

export function AlertFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.severity}
        onChange={(e) => onChange({ ...filters, severity: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="info">Info</option>
      </select>

      <select
        value={filters.module}
        onChange={(e) => onChange({ ...filters, module: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">All Modules</option>
        <option value="dark_web">Dark Web</option>
        <option value="brand">Brand</option>
        <option value="data_leak">Data Leak</option>
        <option value="surface_web">Surface Web</option>
        <option value="credential">Credential</option>
        <option value="cert_monitor">Certificate</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="resolved">Resolved</option>
        <option value="false_positive">False Positive</option>
      </select>
    </div>
  );
}
