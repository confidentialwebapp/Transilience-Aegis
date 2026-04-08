"use client";

import { Eye, Shield, FileWarning, Globe, Key, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG: Record<string, { icon: typeof Eye; bg: string; text: string; label: string }> = {
  dark_web: { icon: Eye, bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400", label: "Dark Web" },
  brand: { icon: Shield, bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400", label: "Brand" },
  data_leak: { icon: FileWarning, bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400", label: "Data Leak" },
  surface_web: { icon: Globe, bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400", label: "Surface Web" },
  credential: { icon: Key, bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "Credential" },
  cert_monitor: { icon: ShieldCheck, bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "Certificate" },
};

interface Props {
  module: string;
  className?: string;
}

export function ModuleBadge({ module, className }: Props) {
  const config = CONFIG[module] || { icon: Globe, bg: "bg-slate-500/10 border-slate-500/30", text: "text-slate-400", label: module };
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
      {config.label}
    </span>
  );
}
