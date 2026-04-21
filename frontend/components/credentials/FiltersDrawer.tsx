"use client";

import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  dateImported: "all" | "7d" | "30d" | "90d" | "custom";
  identifierScope: "tenant" | "global" | "custom";
  passwordPolicy: "none" | "weak" | "medium" | "strong";
  source: "all" | "combolists" | "stealer_logs" | "data_breaches" | "paste_sites" | "telegram_leaks";
  statuses: { new: boolean; ignored: boolean; remediated: boolean };
}

export const DEFAULT_FILTERS: FilterState = {
  dateImported: "all",
  identifierScope: "tenant",
  passwordPolicy: "none",
  source: "all",
  statuses: { new: true, ignored: true, remediated: true },
};

interface Props {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
  spotlightStep?: number;
}

function Row({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl transition-all",
        highlight
          ? "bg-purple-500/[0.06] border border-purple-500/30 glow-purple"
          : "border border-transparent"
      )}
    >
      <label className="block text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/[0.02] border border-purple-500/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500/30 transition-all cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#110d1a]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatusChip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: "emerald" | "slate" | "purple";
  onClick: () => void;
}) {
  const palette = {
    emerald: {
      on: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      off: "bg-white/[0.02] text-slate-500 border-white/[0.04]",
    },
    slate: {
      on: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      off: "bg-white/[0.02] text-slate-500 border-white/[0.04]",
    },
    purple: {
      on: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      off: "bg-white/[0.02] text-slate-500 border-white/[0.04]",
    },
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all",
        active ? palette.on : palette.off
      )}
    >
      {active && <Check className="w-3 h-3" />}
      {label}
    </button>
  );
}

export default function FiltersDrawer({ open, onClose, filters, onApply, spotlightStep = 0 }: Props) {
  const [local, setLocal] = useLocalFilters(filters, open);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] z-50 flex flex-col animate-slide-in"
        style={{
          background: "linear-gradient(180deg, #120d1c 0%, #0a0712 100%)",
          borderLeft: "1px solid rgba(139,92,246,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-white">Filters</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <Row label="Date Imported" highlight={spotlightStep === 8}>
            <Select
              value={local.dateImported}
              onChange={(v) => setLocal({ ...local, dateImported: v as FilterState["dateImported"] })}
              options={[
                { value: "all", label: "All" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
                { value: "custom", label: "Custom range…" },
              ]}
            />
          </Row>

          <Row label="Identifier Scope">
            <Select
              value={local.identifierScope}
              onChange={(v) => setLocal({ ...local, identifierScope: v as FilterState["identifierScope"] })}
              options={[
                { value: "tenant", label: "Tenant" },
                { value: "global", label: "Global" },
                { value: "custom", label: "Custom list…" },
              ]}
            />
          </Row>

          <Row label="Password Policy" highlight={spotlightStep === 9}>
            <Select
              value={local.passwordPolicy}
              onChange={(v) => setLocal({ ...local, passwordPolicy: v as FilterState["passwordPolicy"] })}
              options={[
                { value: "none", label: "None" },
                { value: "weak", label: "Weak (< 8 chars)" },
                { value: "medium", label: "Medium" },
                { value: "strong", label: "Strong" },
              ]}
            />
          </Row>

          <Row label="Source" highlight={spotlightStep === 9}>
            <Select
              value={local.source}
              onChange={(v) => setLocal({ ...local, source: v as FilterState["source"] })}
              options={[
                { value: "all", label: "All" },
                { value: "stealer_logs", label: "Stealer Logs" },
                { value: "combolists", label: "Combolists" },
                { value: "data_breaches", label: "Data Breaches" },
                { value: "paste_sites", label: "Paste Sites" },
                { value: "telegram_leaks", label: "Telegram Leaks" },
              ]}
            />
          </Row>

          <Row label="Status" highlight={spotlightStep === 10}>
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusChip
                active={local.statuses.new}
                color="emerald"
                label="New"
                onClick={() =>
                  setLocal({ ...local, statuses: { ...local.statuses, new: !local.statuses.new } })
                }
              />
              <StatusChip
                active={local.statuses.ignored}
                color="slate"
                label="Ignored"
                onClick={() =>
                  setLocal({ ...local, statuses: { ...local.statuses, ignored: !local.statuses.ignored } })
                }
              />
              <StatusChip
                active={local.statuses.remediated}
                color="purple"
                label="Remediated"
                onClick={() =>
                  setLocal({
                    ...local,
                    statuses: { ...local.statuses, remediated: !local.statuses.remediated },
                  })
                }
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-3">
              All three are enabled by default — toggle off to exclude.
            </p>
          </Row>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 p-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}
        >
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(local);
              onClose();
            }}
            className="flex-1 h-10 rounded-lg text-sm font-semibold text-white btn-brand"
          >
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}

// Keep local filter state in sync whenever the drawer opens
import { useEffect, useState } from "react";
function useLocalFilters(initial: FilterState, open: boolean): [FilterState, (f: FilterState) => void] {
  const [local, setLocal] = useState<FilterState>(initial);
  useEffect(() => {
    if (open) setLocal(initial);
  }, [initial, open]);
  return [local, setLocal];
}
