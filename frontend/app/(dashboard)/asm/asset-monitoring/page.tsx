"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Hash, Award, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityCounters } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useTenantId, shortHash } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { BRANDS } from "@/lib/mock-data";

interface AssetWithFindings {
  id: string;
  type: string;
  value: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
  findings: { severity: string }[];
}

interface AsmDisplay {
  id: string;
  asmId: string;
  rootDomain: string;
  domainExpiry: string;
  sslExpiry: string;
  status: "ENABLED" | "DISABLED";
  brand: string;
  coverage: number;
  totalAssets: number;
  discovered: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

function deriveBrand(meta: Record<string, unknown> | null): string {
  if (meta && typeof meta["brand"] === "string") return meta["brand"] as string;
  return "—";
}

function deriveExpiry(meta: Record<string, unknown> | null, key: string): string {
  if (meta && typeof meta[key] === "string") return meta[key] as string;
  return "—";
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

export default function AssetMonitoringPage() {
  const tenantId = useTenantId();
  const [assets, setAssets] = useState<AssetWithFindings[]>([]);
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
        .select("id, type, value, active, metadata, findings:findings(severity)")
        .eq("tenant_id", tenantId)
        .eq("type", "domain");
      if (cancelled) return;
      setAssets((data ?? []) as AssetWithFindings[]);
      setLoading(false);
    };
    void fetch();
    const channel = supabase
      .channel(`asm:${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "findings", filter: `tenant_id=eq.${tenantId}` }, () => void fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "assets", filter: `tenant_id=eq.${tenantId}` }, () => void fetch())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const display: AsmDisplay[] = useMemo(() => {
    return assets.map((a) => {
      const buckets = bucketize(a.findings);
      return {
        id: a.id,
        asmId: `ASM#${shortHash(a.id)}`,
        rootDomain: a.value,
        domainExpiry: deriveExpiry(a.metadata, "domain_expiry"),
        sslExpiry: deriveExpiry(a.metadata, "ssl_expiry"),
        status: a.active ? "ENABLED" : "DISABLED",
        brand: deriveBrand(a.metadata),
        coverage: 0,
        totalAssets: a.findings?.length ?? 0,
        discovered: 0,
        ...buckets,
      };
    });
  }, [assets]);

  const total = display.length;
  const startIdx = (page - 1) * pageSize;
  const rows = display.slice(startIdx, startIdx + pageSize);

  const cols: Column<AsmDisplay>[] = [
    { key: "id", header: "ASM ID", render: (r) => <span className="text-[12px] font-mono text-purple-300 font-semibold">{r.asmId}</span> },
    {
      key: "domain",
      header: "Root Domain",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12.5px] text-slate-200 font-semibold">{r.rootDomain}</p>
          <p className="text-[10px] text-slate-500">Domain Expiry: {r.domainExpiry}</p>
          <p className="text-[10px] text-slate-500">SSL Expiry: {r.sslExpiry}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "coverage",
      header: "Coverage",
      align: "right",
      render: (r) => (
        <div className="flex flex-col items-end gap-1 min-w-[60px]">
          <span className="text-[12px] font-bold text-purple-300 tabular-nums">{r.coverage}%</span>
          <div className="w-16 h-1 rounded-full bg-purple-500/10 overflow-hidden">
            <div className="h-full rounded-full bg-purple-400" style={{ width: `${r.coverage}%` }} />
          </div>
        </div>
      ),
    },
    { key: "totalAssets", header: "Findings", align: "right", render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.totalAssets}</span> },
    { key: "discovered", header: "Discovered", align: "right", render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.discovered}</span> },
    {
      key: "findings",
      header: "Severity",
      render: (r) => <SeverityCounters critical={r.critical} high={r.high} medium={r.medium} low={r.low} />,
    },
  ];

  const livePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}
    >
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : `LIVE · ${total} ASSETS`}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Asset Monitoring"
        description="Central repository and management of the customer's monitored attack surface. Coverage reflects how much of each domain has been mapped and is under active monitoring."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Root Domain" />
          <FilterInput icon={Hash} placeholder="ASM ID" />
          <FilterSelect icon={Award} label="Brand" options={BRANDS} />
          <FilterSelect label="Status" options={["ENABLED", "DISABLED"]} />
        </div>
      </FilterCard>

      <DataTable<AsmDisplay>
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
