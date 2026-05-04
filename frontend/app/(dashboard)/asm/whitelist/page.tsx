"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { fetchWhitelist } from "@/lib/derived";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "brands", label: "Brands" },
  { key: "domains", label: "Domains" },
  { key: "subdomains", label: "Subdomains" },
  { key: "mobile_apps", label: "Mobile Apps" },
  { key: "social_profiles", label: "Social Profiles" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function WhitelistPage() {
  const [tab, setTab] = useState<Tab>("brands");
  const [data, setData] = useState<Record<Tab, any[]>>({ brands: [], domains: [], subdomains: [], mobile_apps: [], social_profiles: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWhitelist().then((j) => setData({
      brands: j.brands || [], domains: j.domains || [], subdomains: j.subdomains || [],
      mobile_apps: j.mobile_apps || [], social_profiles: j.social_profiles || [],
    })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cols: Record<Tab, Column<any>[]> = {
    brands: [
      { key: "name", header: "Brand", render: (r) => <span className="text-[12.5px] font-semibold text-slate-200">{r.name}</span> },
      { key: "client", header: "Client", render: (r) => <span className="text-[12px] text-slate-400">{r.client}</span> },
      { key: "country", header: "Country", render: (r) => <span className="text-[12px] text-slate-400">{r.country}</span> },
      { key: "monitoring", header: "Monitoring", render: (r) => r.monitoring ? <span className="text-[11px] font-bold text-emerald-400">YES</span> : <Link href="#" className="text-[11px] text-purple-300 underline">Request</Link> },
      { key: "added", header: "Added", render: (r) => <span className="text-[12px] text-slate-400">{r.added}</span> },
    ],
    domains: [
      { key: "domain", header: "Domain", render: (r) => <span className="text-[12.5px] font-mono text-slate-200">{r.domain}</span> },
      { key: "type", header: "Type", render: (r) => <span className="text-[11.5px] text-slate-400 capitalize">{r.type}</span> },
      { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
      { key: "monitoring", header: "Monitoring", render: (r) => r.monitoring ? <span className="text-[11px] font-bold text-emerald-400">YES</span> : <span className="text-[11px] text-slate-500">no</span> },
      { key: "added", header: "Added", render: (r) => <span className="text-[12px] text-slate-400">{r.added}</span> },
    ],
    subdomains: [
      { key: "subdomain", header: "Subdomain", render: (r) => <span className="text-[12.5px] font-mono text-slate-200">{r.subdomain}</span> },
    ],
    mobile_apps: [
      { key: "package_id", header: "Package ID", render: (r) => <span className="text-[12.5px] font-mono text-slate-200">{r.package_id}</span> },
      { key: "platform", header: "Platform", render: (r) => <span className="text-[11.5px] text-slate-400 uppercase">{r.platform}</span> },
      { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
      { key: "official", header: "Official", render: (r) => r.official ? <span className="text-[11px] font-bold text-emerald-400">YES</span> : <span className="text-[11px] text-slate-500">no</span> },
    ],
    social_profiles: [
      { key: "handle", header: "Handle", render: (r) => <span className="text-[12.5px] font-mono text-slate-200">{r.handle}</span> },
      { key: "platform", header: "Platform", render: (r) => <span className="text-[11.5px] text-slate-400">{r.platform}</span> },
      { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
      { key: "official", header: "Official", render: (r) => r.official ? <span className="text-[11px] font-bold text-emerald-400">YES</span> : <span className="text-[11px] text-slate-500">no</span> },
    ],
  };

  return (
    <>
      <PageHeader
        title="Whitelist Management"
        description="Authorised brand assets — domains, mobile apps, social handles, and brands declared as legitimate. Whitelisted entries are excluded from auto-takedown workflows."
      />
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg w-fit overflow-x-auto"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all whitespace-nowrap",
              tab === t.key ? "text-white" : "text-slate-400 hover:text-white")}
            style={tab === t.key ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}>
            {t.label} <span className="opacity-60 ml-1 text-[10px]">{(data[t.key] || []).length}</span>
          </button>
        ))}
      </div>
      <DataTable<any> columns={cols[tab]} rows={data[tab]} totalEntries={data[tab].length} pageSize={data[tab].length || 1} page={1} rowAction={false}
        emptyText={loading ? "Loading…" : "No data available."} />
    </>
  );
}
