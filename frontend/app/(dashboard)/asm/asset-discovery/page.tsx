"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Search, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityCounters } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useTenantId } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { BRANDS } from "@/lib/mock-data";

interface SubdomainAsset {
  id: string;
  type: string;
  value: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  findings: { severity: string }[];
}

interface DiscoveryDisplay {
  id: string;
  subdomain: string;
  parent: string;
  http: number;
  status: "ACTIVE" | "INACTIVE" | "RESOLVED" | "UNKNOWN";
  sslExpiry: string;
  invalidSsl: boolean;
  critical: number;
  high: number;
  medium: number;
  low: number;
  discovered: string;
}

function meta<T = string>(m: Record<string, unknown> | null, key: string, fallback: T): T {
  if (m && key in m) return m[key] as T;
  return fallback;
}

function bucketize(findings: { severity: string }[]) {
  let critical = 0, high = 0, medium = 0, low = 0;
  for (const f of findings ?? []) {
    if (f.severity === "Critical") critical += 1;
    else if (f.severity === "Substantial") high += 1;
    else if (f.severity === "Moderate") medium += 1;
    else if (f.severity === "Low") low += 1;
  }
  return { critical, high, medium, low };
}

export default function AssetDiscoveryPage() {
  const tenantId = useTenantId();
  const [assets, setAssets] = useState<SubdomainAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    const fetch = async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, type, value, active, metadata, created_at, findings:findings(severity)")
        .eq("tenant_id", tenantId)
        .eq("type", "subdomain")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setAssets((data ?? []) as SubdomainAsset[]);
      setLoading(false);
    };
    void fetch();
    const channel = supabase
      .channel(`discovery:${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assets", filter: `tenant_id=eq.${tenantId}` }, () => void fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "findings", filter: `tenant_id=eq.${tenantId}` }, () => void fetch())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const display: DiscoveryDisplay[] = useMemo(() => {
    return assets.map((a) => {
      const buckets = bucketize(a.findings);
      const parent = a.value.split(".").slice(-2).join(".");
      return {
        id: a.id,
        subdomain: a.value,
        parent,
        http: meta<number>(a.metadata, "http_status", 0),
        status: meta<DiscoveryDisplay["status"]>(a.metadata, "live_status", a.active ? "ACTIVE" : "UNKNOWN"),
        sslExpiry: meta<string>(a.metadata, "ssl_expiry", "—"),
        invalidSsl: meta<boolean>(a.metadata, "invalid_ssl", false),
        ...buckets,
        discovered: new Date(a.created_at).toLocaleString(),
      };
    });
  }, [assets]);

  const total = display.length;
  const startIdx = (page - 1) * pageSize;
  const rows = display.slice(startIdx, startIdx + pageSize);

  const cols: Column<DiscoveryDisplay>[] = [
    {
      key: "subdomain",
      header: "Subdomain",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12.5px] text-slate-200 font-semibold">{r.subdomain}</p>
          <p className="text-[10px] text-slate-500">{r.invalidSsl ? "Invalid SSL" : `SSL Expiry: ${r.sslExpiry}`}</p>
        </div>
      ),
    },
    { key: "parent", header: "Parent Domain", render: (r) => <span className="text-[12px] text-slate-300">{r.parent}</span> },
    {
      key: "http",
      header: "HTTP",
      align: "center",
      render: (r) => (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold tabular-nums"
          style={{
            background: r.http === 200 ? "rgba(16,185,129,0.10)" : r.http === 404 ? "rgba(249,115,22,0.10)" : "rgba(148,163,184,0.10)",
            color: r.http === 200 ? "#6ee7b7" : r.http === 404 ? "#fdba74" : "#94a3b8",
            border: r.http === 200 ? "1px solid rgba(16,185,129,0.30)" : r.http === 404 ? "1px solid rgba(249,115,22,0.30)" : "1px solid rgba(148,163,184,0.30)",
          }}
        >
          {r.http || "—"}
        </span>
      ),
    },
    {
      key: "vulns",
      header: "Vulnerabilities",
      render: (r) => <SeverityCounters critical={r.critical} high={r.high} medium={r.medium} low={r.low} />,
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "discovered", header: "Discovered", render: (r) => <span className="text-[11px] text-slate-500">{r.discovered}</span> },
  ];

  const livePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}
    >
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : `LIVE · ${total} SUBDOMAINS`}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Asset Discovery"
        description="Central repository of automatically discovered subdomains and IPs. New surfaces are surfaced continuously via passive DNS, certificate transparency, and active probing."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Search} placeholder="Subdomain" />
          <FilterInput icon={Globe} placeholder="Parent Domain" />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["ACTIVE", "INACTIVE", "RESOLVED", "UNKNOWN"]} />
          <FilterSelect label="HTTP Code" options={["200", "404", "0"]} />
        </div>
      </FilterCard>

      <DataTable<DiscoveryDisplay>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        emptyText={loading ? "Loading…" : "No data available."}
      />
    </>
  );
}
