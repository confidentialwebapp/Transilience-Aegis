"use client";

import { Globe, Server, Mail, Hash } from "lucide-react";
import type { TopAsset } from "@/lib/api";

const TYPE_ICONS: Record<string, typeof Globe> = {
  domain: Globe,
  ip: Server,
  email: Mail,
  keyword: Hash,
};

interface Props {
  assets: TopAsset[];
}

export function TopAssetsTable({ assets }: Props) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Top Assets
      </h2>

      {assets.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-8">No asset data yet</div>
      ) : (
        <div className="space-y-3">
          {assets.slice(0, 8).map((asset, idx) => {
            const Icon = TYPE_ICONS[asset.type] || Globe;
            const maxMentions = assets[0]?.mentions || 1;
            const widthPct = (asset.mentions / maxMentions) * 100;

            return (
              <div key={asset.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-4">{idx + 1}</span>
                <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{asset.value}</div>
                  <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-300 ml-2">{asset.mentions}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
