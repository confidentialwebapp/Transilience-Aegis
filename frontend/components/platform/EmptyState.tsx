"use client";

import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title = "No data available.", description, icon: Icon, action, className }: Props) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl", className)}
      style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(139,92,246,0.15)" }}
    >
      {Icon && (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <Icon className="w-6 h-6 text-purple-300/70" />
        </div>
      )}
      <p className="italic text-[12.5px] text-slate-500 font-medium">{title}</p>
      {description && <p className="text-[11px] text-slate-600 mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
