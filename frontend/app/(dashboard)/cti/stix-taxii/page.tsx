"use client";

import { useEffect, useState } from "react";
import { Code2, FileBadge, Database } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchTaxiiCollections } from "@/lib/derived";

export default function StixTaxiiPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaxiiCollections()
      .then((j) => { setCollections(j.collections || []); setDiscoveryUrl(j.discovery_url || ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="STIX / TAXII"
        description="STIX 2.1 collections this server publishes via TAXII 2.1. Subscribe with any TAXII client to ingest brand-targeted indicators, APT attribution data, and ransomware leak posts directly into your SIEM."
      />

      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-2">Discovery URL</p>
        <code className="block text-[11.5px] text-slate-200 font-mono px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.35)" }}>
          {process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com"}{discoveryUrl}
        </code>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 h-32 animate-pulse" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }} />
        ))}
        {collections.map((c) => (
          <div key={c.id} className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileBadge className="w-4 h-4 text-purple-300" />
              <p className="text-[11px] font-semibold tracking-[0.13em] text-purple-300 uppercase">{c.id}</p>
            </div>
            <h3 className="text-[14px] font-semibold text-white">{c.title}</h3>
            <p className="text-[12px] text-slate-400 mt-1.5">{c.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
                <Database className="w-2.5 h-2.5" /> {c.object_count.toLocaleString()} objects
              </span>
              <div className="flex gap-1">
                {c.can_read && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">READ</span>}
                {c.can_write && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">WRITE</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
