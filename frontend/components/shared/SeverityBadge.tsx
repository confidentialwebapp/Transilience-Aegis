"use client";

import { AlertTriangle, AlertCircle, Info, ShieldAlert, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG: Record<string, { icon: typeof AlertTriangle; bg: string; text: string }> = {
  critical: { icon: ShieldX, bg: "bg-red-500/10 border-red-500/30", text: "text-red-400" },
  high: { icon: ShieldAlert, bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400" },
  medium: { icon: AlertTriangle, bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400" },
  low: { icon: AlertCircle, bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400" },
  info: { icon: Info, bg: "bg-slate-500/10 border-slate-500/30", text: "text-slate-400" },
};

interface Props {
  severity: string;
  className?: string;
}

export function SeverityBadge({ severity, className }: Props) {
  const config = CONFIG[severity] || CONFIG.info;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.bg,
        config.text,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {severity.toUpperCase()}
    </span>
  );
}
