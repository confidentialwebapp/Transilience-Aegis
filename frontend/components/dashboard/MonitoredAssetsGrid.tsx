"use client";

import {
  Globe,
  Server,
  Mail,
  Hash,
  Github,
  Users,
  ShieldCheck,
  Network,
} from "lucide-react";

const ASSET_CONFIG: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  domain: { icon: Globe, color: "cyan", label: "Domains" },
  ip: { icon: Server, color: "blue", label: "IP Addresses" },
  email: { icon: Mail, color: "purple", label: "Emails" },
  keyword: { icon: Hash, color: "orange", label: "Keywords" },
  github_org: { icon: Github, color: "emerald", label: "GitHub Orgs" },
  social: { icon: Users, color: "pink", label: "Social Handles" },
  certificate: { icon: ShieldCheck, color: "yellow", label: "Certificates" },
};

const COLOR_MAP: Record<string, string> = {
  cyan: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

interface Props {
  assets: Record<string, number>;
  total: number;
}

export function MonitoredAssetsGrid({ assets, total }: Props) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Monitored Assets
        </h2>
        <span className="text-xs text-slate-500">{total} total</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(ASSET_CONFIG).map(([type, config]) => {
          const count = assets[type] || 0;
          const Icon = config.icon;
          return (
            <div
              key={type}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-slate-800/50 ${COLOR_MAP[config.color]}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs opacity-70">{config.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
