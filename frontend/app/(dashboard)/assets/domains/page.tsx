"use client";

import { useMemo, useState } from "react";
import { Globe, Plus, Activity, Lock } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, Toggle, TagGroup, SeverityBar } from "@/components/platform";
import type { Column, SeverityLevel } from "@/components/platform";
import { useFindings, useTenantId, type FindingRow } from "@/lib/realtime";
import { BRANDS } from "@/lib/mock-data";

interface DomainRow {
  id: string;
  domain: string;
  brand: string;
  registrar: string;
  domainAge: number | null;
  sslIssuer: string;
  sslExpiry: string;
  nameservers: string[];
  techStack: string[];
  monitoring: boolean;
  severity: SeverityLevel;
  status: "ACTIVE" | "INACTIVE";
  added: string;
}

function asString(v: unknown, fb = "—"): string {
  return typeof v === "string" && v.length > 0 ? v : fb;
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function toDomainRow(r: FindingRow): DomainRow {
  const ev = (r.evidence ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    domain: asString(ev["domain"] ?? r.url_or_value, "—"),
    brand: asString(ev["brand"], "—"),
    registrar: asString(ev["registrar"]),
    domainAge: asNumber(ev["domain_age_days"]),
    sslIssuer: asString(ev["ssl_issuer"]),
    sslExpiry: asString(ev["ssl_expiry"]),
    nameservers: asArray(ev["name_servers"] ?? ev["nameservers"]),
    techStack: asArray(ev["tech_stack"] ?? ev["technologies"]),
    monitoring: true,
    severity: (r.severity as SeverityLevel) ?? "Low",
    status: "ACTIVE",
    added: new Date(r.created_at).toLocaleString(),
  };
}

export default function DomainsAssetsPage() {
  const tenantId = useTenantId();
  const { data: findings, loading } = useFindings(tenantId);

  const [filterBrand, setFilterBrand] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const domains = useMemo<DomainRow[]>(() => {
    return findings
      .filter((f) => f.feature_id === "FEAT-019" || f.kind === "domain_intel")
      .map(toDomainRow);
  }, [findings]);

  const filtered = useMemo(() => {
    return domains.filter((d) => {
      if (filterBrand && d.brand !== filterBrand) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterAge === "<30 days" && (d.domainAge === null || d.domainAge >= 30)) return false;
      if (filterAge === "<90 days" && (d.domainAge === null || d.domainAge >= 90)) return false;
      if (filterSearch && !d.domain.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
  }, [domains, filterBrand, filterStatus, filterAge, filterSearch]);

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const rows = filtered.slice(startIdx, startIdx + pageSize);

  const cols: Column<DomainRow>[] = [
    { key: "domain", header: "Domain", render: (r) => <span className="text-[12.5px] text-slate-200 font-semibold">{r.domain}</span> },
    {
      key: "age",
      header: "Age",
      align: "right",
      render: (r) => {
        if (r.domainAge === null) return <span className="text-[11px] text-slate-600">—</span>;
        const color = r.domainAge < 30 ? "text-red-400" : r.domainAge < 90 ? "text-amber-400" : "text-emerald-400";
        return <span className={`text-[12px] tabular-nums font-bold ${color}`}>{r.domainAge}d</span>;
      },
    },
    { key: "registrar", header: "Registrar", render: (r) => <span className="text-[12px] text-slate-400">{r.registrar}</span> },
    {
      key: "ssl",
      header: "SSL Issuer",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-500" />
          <span className={`text-[11.5px] ${r.sslIssuer.toLowerCase().includes("let's encrypt") ? "text-amber-400" : "text-slate-300"}`}>{r.sslIssuer}</span>
        </div>
      ),
    },
    { key: "expiry", header: "SSL Expiry", render: (r) => <span className="text-[11.5px] text-slate-400">{r.sslExpiry}</span> },
    {
      key: "ns",
      header: "Nameservers",
      render: (r) => r.nameservers.length > 0 ? <span className="text-[11px] text-slate-300 font-mono truncate inline-block max-w-[180px]">{r.nameservers[0]}</span> : <span className="text-[11px] text-slate-600">—</span>,
    },
    { key: "tech", header: "Tech", render: (r) => r.techStack.length > 0 ? <TagGroup tags={r.techStack} max={3} /> : <span className="text-[11px] text-slate-600">—</span> },
    { key: "severity", header: "Risk", render: (r) => <SeverityBar level={r.severity} /> },
    { key: "added", header: "Last Refreshed", render: (r) => <span className="text-[11px] text-slate-500">{r.added}</span> },
  ];

  const livePill = (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}>
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : `LIVE · ${domains.length} DOMAINS TRACKED`}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Domains"
        description="Authoritative list of brand-owned domains with WHOIS / DNS / SSL / tech-stack intelligence refreshed daily by the Apify domain-intel pipeline."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Domain
          </button>
        }
      />
      <FilterCard onSearch={() => setPage(1)} onReset={() => { setFilterBrand(""); setFilterStatus(""); setFilterAge(""); setFilterSearch(""); setPage(1); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterInput icon={Globe} placeholder="Domain" value={filterSearch} onChange={setFilterSearch} />
          <FilterSelect label="Brand" options={BRANDS} value={filterBrand} onChange={setFilterBrand} />
          <FilterSelect label="Domain Age" options={["<30 days", "<90 days"]} value={filterAge} onChange={setFilterAge} />
          <FilterSelect label="Status" options={["ACTIVE", "INACTIVE"]} value={filterStatus} onChange={setFilterStatus} />
        </div>
      </FilterCard>
      <DataTable<DomainRow>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        emptyText={loading ? "Loading…" : "No domain intelligence yet. Apify FEAT-019 runs daily — manually trigger from Admin → Run Scan."}
      />
    </>
  );
}
