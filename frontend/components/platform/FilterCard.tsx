"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Search, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  onSearch?: () => void;
  onReset?: () => void;
  defaultOpen?: boolean;
  rightSlot?: ReactNode;
  className?: string;
  collapsible?: boolean;
}

export function FilterCard({
  children,
  onSearch,
  onReset,
  defaultOpen = true,
  rightSlot,
  className,
  collapsible = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn("rounded-xl mb-4 overflow-hidden", className)}
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-500/[0.06]">
        <span className="text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase">Filters</span>
        <div className="flex items-center gap-2">
          {rightSlot}
          {collapsible && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="p-4 space-y-3">
          {children}
          {(onSearch || onReset) && (
            <div className="flex justify-end gap-2 pt-2">
              {onReset && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white transition-all"
                  style={{ background: "transparent", border: "1px solid rgba(139,92,246,0.25)" }}
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
              {onSearch && (
                <button
                  onClick={onSearch}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
                >
                  <Search className="w-3 h-3" /> Search
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterInput({
  icon: Icon,
  placeholder,
  helper,
  value,
  onChange,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  placeholder: string;
  helper?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
        <input
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200 placeholder:text-slate-600 min-w-0"
        />
      </div>
      {helper && <span className="text-[10px] text-slate-600 px-1">{helper}</span>}
    </div>
  );
}

export function FilterSelect({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200 min-w-0 appearance-none cursor-pointer"
      >
        <option value="" className="bg-[#0d0a14]">{label}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#0d0a14]">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
