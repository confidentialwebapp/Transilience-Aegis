"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string | ReactNode;
  render: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  totalEntries?: number;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  selectable?: boolean;
  rowAction?: boolean;
  onRowAction?: (row: T) => void;
  emptyText?: string;
  rowKey?: (row: T, index: number) => string;
}

export function DataTable<T>({
  columns,
  rows,
  totalEntries,
  pageSize = 100,
  page = 1,
  onPageChange,
  selectable = false,
  rowAction = true,
  onRowAction,
  emptyText = "No data available.",
  rowKey,
}: Props<T>) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const total = totalEntries ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;

  const toggleSelectAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "rgba(139,92,246,0.10)", background: "rgba(255,255,255,0.02)" }}>
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-purple-500"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left"
                  )}
                  style={{ width: c.width }}
                >
                  {c.header}
                </th>
              ))}
              {rowAction && <th className="w-10 px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (rowAction ? 1 : 0)}
                  className="px-3 py-12 text-center text-[12px] text-slate-500 italic"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  className="border-b transition-colors hover:bg-white/[0.02] group"
                  style={{ borderColor: "rgba(139,92,246,0.05)" }}
                >
                  {selectable && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(idx)}
                        onChange={() => {
                          const s = new Set(selected);
                          if (s.has(idx)) s.delete(idx);
                          else s.add(idx);
                          setSelected(s);
                        }}
                        className="w-3.5 h-3.5 rounded accent-purple-500"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-3 text-[12px] text-slate-300",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className
                      )}
                    >
                      {c.render(row, idx)}
                    </td>
                  ))}
                  {rowAction && (
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onRowAction?.(row)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: "rgba(139,92,246,0.10)", background: "rgba(255,255,255,0.015)" }}
        >
          <span className="text-[11px] text-slate-500">
            Showing <span className="text-slate-300 font-medium">{startIdx + 1}</span> to{" "}
            <span className="text-slate-300 font-medium">{Math.min(startIdx + rows.length, total)}</span> of{" "}
            <span className="text-slate-300 font-medium">{total.toLocaleString()}</span> entries
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange?: (p: number) => void;
}) {
  const change = (p: number) => {
    if (p >= 1 && p <= totalPages) onChange?.(p);
  };

  const renderPages = () => {
    const items: (number | "...")[] = [];
    const max = Math.min(totalPages, 7);
    if (totalPages <= max) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (page > 3) items.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (page < totalPages - 2) items.push("...");
      items.push(totalPages);
    }
    return items;
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => change(page - 1)}
        disabled={page === 1}
        className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all flex items-center gap-1"
      >
        <ChevronLeft className="w-3 h-3" /> Previous
      </button>
      {renderPages().map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-[11px] text-slate-600">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => change(p)}
            className={cn(
              "min-w-[28px] h-7 px-1.5 rounded-md text-[11px] font-semibold tabular-nums transition-all",
              p === page
                ? "text-white"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            )}
            style={p === page ? { background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" } : undefined}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => change(page + 1)}
        disabled={page === totalPages}
        className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all flex items-center gap-1"
      >
        Next <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  size = "md",
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      onClick={() => onChange?.(!on)}
      className={cn(
        "relative rounded-full transition-colors",
        sm ? "w-8 h-4" : "w-9 h-5",
        on ? "bg-purple-500/70" : "bg-slate-700"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full bg-white transition-all",
          sm ? "w-3 h-3" : "w-4 h-4",
          on && (sm ? "translate-x-4" : "translate-x-4")
        )}
      />
    </button>
  );
}
