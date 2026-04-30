"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe, Hash, Award, AlertTriangle, ToggleLeft, Inbox, Activity, Layers } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityBar, TagPill } from "@/components/platform";
import type { Column, SeverityLevel } from "@/components/platform";
import { useFindings, useTenantId, type FindingRow, formatKind, actionToStatus, shortHash } from "@/lib/realtime";
import { BRANDS } from "@/lib/mock-data";

// kinds we surface on the Incidents board (everything except credential breaches,
// which live on the DLR page; mobile-app fraud also routes through here so
// recruiters / fake branches / fake apps all surface in one place for the SOC)
const INCIDENT_KINDS = new Set([
  "phishing",
  "brand_impersonation",
  "exec_impersonation",
  "fraud",
  "domain_typosquat",
  "leaked_asset",
  "username_squat",
  "fake_app",
  "fake_branch",
  "job_scam",
  "defacement",
  "domain_intel",
  "supply_chain",
]);

// Friendly fraud-pattern labels for the filter dropdown
const FRAUD_PATTERN_OPTIONS = [
  "Phishing",
  "Fake App",
  "Fake Branch",
  "Recruitment Scam",
  "Recovery Scam",
  "Impersonation",
  "Defacement",
  "Domain Typosquat",
  "Credential Leak",
];

const FRAUD_PATTERN_TO_DB: Record<string, string> = {
  "Phishing": "phishing",
  "Fake App": "fake_app",
  "Fake Branch": "fake_branch",
  "Recruitment Scam": "job_scam",
  "Recovery Scam": "recovery_scam",
  "Impersonation": "impersonation",
  "Defacement": "defacement",
  "Domain Typosquat": "domain_typosquat",
  "Credential Leak": "leak",
};

interface IncidentDisplay {
  id: string;
  caseHash: string;
  status: string;
  type: string;
  url: string;
  brand: string;
  feature: string | null;
  fraudPattern: string | null;
  severity: SeverityLevel;
  uptimeMin: number;
  addedAt: string;
}

function deriveBrand(r: FindingRow): string {
  const ev = r.evidence as Record<string, unknown> | null;
  if (ev && typeof ev["brand"] === "string") return ev["brand"] as string;
  return "—";
}

function toDisplay(r: FindingRow): IncidentDisplay {
  const added = new Date(r.created_at);
  const uptimeMin = Math.max(0, Math.floor((Date.now() - added.getTime()) / 60000));
  return {
    id: r.id,
    caseHash: shortHash(r.id),
    status: actionToStatus(r.recommended_action),
    type: formatKind(r.kind),
    url: r.url_or_value ?? "—",
    brand: deriveBrand(r),
    feature: r.feature_id ?? null,
    fraudPattern: r.fraud_pattern ?? null,
    severity: (r.severity as SeverityLevel) ?? "Low",
    uptimeMin,
    addedAt: added.toLocaleString(),
  };
}

export default function IncidentsPage() {
  const tenantId = useTenantId();
  const { data: findings, loading } = useFindings(tenantId);

  const [page, setPage] = useState(1);
  const [filterBrand, setFilterBrand] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterFeature, setFilterFeature] = useState("");
  const [filterFraudPattern, setFilterFraudPattern] = useState("");
  const [urlSearch, setUrlSearch] = useState("");
  const [caseSearch, setCaseSearch] = useState("");

  // Distinct feature_ids surfaced from current findings (for the filter dropdown)
  const featureOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.feature_id) set.add(f.feature_id);
    }
    return Array.from(set).sort();
  }, [findings]);

  const pageSize = 100;

  const incidents: IncidentDisplay[] = useMemo(() => {
    const filtered = findings.filter((f) => INCIDENT_KINDS.has(f.kind));
    return filtered.map(toDisplay);
  }, [findings]);

  const filtered = useMemo(() => {
    return incidents.filter((r) => {
      if (filterBrand && r.brand !== filterBrand) return false;
      if (filterSeverity && r.severity !== filterSeverity) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterKind && !r.type.toLowerCase().includes(filterKind.toLowerCase())) return false;
      if (filterFeature && r.feature !== filterFeature) return false;
      if (filterFraudPattern) {
        const dbVal = FRAUD_PATTERN_TO_DB[filterFraudPattern];
        if (r.fraudPattern !== dbVal) return false;
      }
      if (urlSearch) {
        const needles = urlSearch.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (needles.length && !needles.some((n) => r.url.toLowerCase().includes(n))) return false;
      }
      if (caseSearch) {
        const needles = caseSearch.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (needles.length && !needles.some((n) => r.caseHash.toLowerCase().includes(n))) return false;
      }
      return true;
    });
  }, [incidents, filterBrand, filterSeverity, filterStatus, filterKind, filterFeature, filterFraudPattern, urlSearch, caseSearch]);

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const rows = filtered.slice(startIdx, startIdx + pageSize);

  const cols: Column<IncidentDisplay>[] = [
    {
      key: "case",
      header: "Case ID",
      width: "240px",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12px] font-mono text-purple-300 font-semibold">CASE : {r.caseHash}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Added: {r.addedAt}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "type",
      header: "Type / URL",
      render: (r) => (
        <div className="leading-snug max-w-[280px]">
          <p className="text-[11px] text-slate-400">{r.type}</p>
          <a className="text-[12px] text-purple-300 hover:text-purple-200 truncate block" href={r.url.startsWith("http") ? r.url : "#"} target="_blank" rel="noopener noreferrer">{r.url}</a>
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "feature",
      header: "Feature",
      render: (r) => (r.feature ? <TagPill label={r.feature} /> : <span className="text-[11px] text-slate-600">—</span>),
    },
    { key: "threat", header: "Threat", render: (r) => <SeverityBar level={r.severity} /> },
    {
      key: "uptime",
      header: "Uptime (hh:mm)",
      align: "right",
      render: (r) => {
        const h = Math.floor(r.uptimeMin / 60);
        const m = r.uptimeMin % 60;
        return <span className="font-mono text-[12px] text-slate-300">{h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}</span>;
      },
    },
  ];

  const livePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{
        background: "rgba(16,185,129,0.10)",
        color: "#6ee7b7",
        border: "1px solid rgba(16,185,129,0.30)",
      }}
    >
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : incidents.length > 0 ? `LIVE · ${incidents.length} ACTIVE` : "LIVE · NO INCIDENTS YET"}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Incidents"
        description="Master list of all infringing or malicious content approved for takedown. Each actionable threat carries a unique case ID, lifecycle status, and uptime tracking."
      />

      <FilterCard
        rightSlot={
          <Link href="/case-manager/reported-by-clients" className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1">
            <Inbox className="w-3 h-3" /> Reported Incidents
          </Link>
        }
        onSearch={() => setPage(1)}
        onReset={() => {
          setFilterBrand("");
          setFilterSeverity("");
          setFilterStatus("");
          setFilterKind("");
          setFilterFeature("");
          setFilterFraudPattern("");
          setUrlSearch("");
          setCaseSearch("");
          setPage(1);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Multiple URLs" helper="paste multiple entries separated by commas" value={urlSearch} onChange={setUrlSearch} />
          <FilterInput icon={Hash} placeholder="Multiple Case IDs" helper="paste multiple entries separated by commas" value={caseSearch} onChange={setCaseSearch} />
          <FilterSelect icon={Award} label="Brand" options={BRANDS} value={filterBrand} onChange={setFilterBrand} />
          <FilterSelect icon={AlertTriangle} label="Threat Level" options={["Critical", "Substantial", "Moderate", "Low"]} value={filterSeverity} onChange={setFilterSeverity} />
          <FilterSelect icon={ToggleLeft} label="Status" options={["OPEN", "CLOSED", "WAITING", "ON HOLD"]} value={filterStatus} onChange={setFilterStatus} />
          <FilterSelect icon={Hash} label="Incident Type" options={["Phishing", "Brand Impersonation", "Exec Impersonation", "Domain Typosquat", "Leaked Asset", "Fraud"]} value={filterKind} onChange={setFilterKind} />
          <FilterSelect icon={Layers} label="Feature" options={featureOptions} value={filterFeature} onChange={setFilterFeature} />
          <FilterSelect icon={AlertTriangle} label="Fraud Pattern" options={FRAUD_PATTERN_OPTIONS} value={filterFraudPattern} onChange={setFilterFraudPattern} />
        </div>
      </FilterCard>

      <DataTable<IncidentDisplay>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        selectable
        emptyText={loading ? "Loading…" : "No data available."}
      />
    </>
  );
}
