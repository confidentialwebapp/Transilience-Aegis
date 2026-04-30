"use client";

import { useMemo, useState } from "react";
import { Plus, Smartphone, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityBar, TagGroup } from "@/components/platform";
import type { Column, SeverityLevel } from "@/components/platform";
import { useFindings, useTenantId, type FindingRow, shortHash } from "@/lib/realtime";
import { BRANDS } from "@/lib/mock-data";

interface MobileAppDisplay {
  id: string;
  appId: string;
  title: string;
  developer: string;
  store: "Google Play" | "App Store" | "Other";
  language: string;
  rating?: string;
  installs?: string;
  permissions: string[];
  severity: SeverityLevel;
  url: string;
  added: string;
  rogue: boolean;
}

const OFFICIAL_PUBLISHERS = new Set(["CreditAccess Grameen Limited", "creditaccess grameen limited"]);
const OFFICIAL_APP_IDS = new Set(["com.creditaccessgrameen.mahi"]);

function deriveStore(source: string): MobileAppDisplay["store"] {
  if (source.includes("google-play")) return "Google Play";
  if (source.includes("appstore") || source.includes("app-store")) return "App Store";
  return "Other";
}

function asString(v: unknown, fallback = "—"): string {
  return typeof v === "string" ? v : (typeof v === "number" ? String(v) : fallback);
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toDisplay(r: FindingRow, idx: number): MobileAppDisplay {
  const ev = (r.evidence ?? {}) as Record<string, unknown>;
  const developer = asString(ev["developer"] ?? ev["developerName"], "Unknown");
  const appId = asString(ev["app_id"] ?? ev["appId"], r.url_or_value ?? `app-${idx}`);
  const isOfficial = OFFICIAL_PUBLISHERS.has(developer.toLowerCase()) || OFFICIAL_APP_IDS.has(appId);
  return {
    id: r.id,
    appId,
    title: asString(ev["title"] ?? ev["name"], appId),
    developer,
    store: deriveStore(r.source ?? ""),
    language: r.language_detected ?? "en",
    rating: typeof ev["rating"] === "number" ? (ev["rating"] as number).toFixed(1) : asString(ev["rating"], undefined),
    installs: asString(ev["installs"] ?? ev["installCount"], undefined),
    permissions: asArray(ev["permissions"]),
    severity: (r.severity as SeverityLevel) ?? "Low",
    url: r.url_or_value ?? `https://play.google.com/store/apps/details?id=${appId}`,
    added: new Date(r.created_at).toLocaleString(),
    rogue: !isOfficial,
  };
}

export default function MobileAppsPage() {
  const tenantId = useTenantId();
  const { data: findings, loading } = useFindings(tenantId);

  const [filterStore, setFilterStore] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const apps = useMemo<MobileAppDisplay[]>(() => {
    return findings
      .filter((f) =>
        f.feature_id === "FEAT-001" ||
        f.feature_id === "FEAT-002" ||
        f.fraud_pattern === "fake_app" ||
        (f.source ?? "").includes("google-play") ||
        (f.source ?? "").includes("app-store")
      )
      .map(toDisplay);
  }, [findings]);

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      if (filterStore && a.store !== filterStore) return false;
      if (filterSeverity && a.severity !== filterSeverity) return false;
      if (filterStatus === "Rogue" && !a.rogue) return false;
      if (filterStatus === "Official" && a.rogue) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!a.appId.toLowerCase().includes(q) && !a.title.toLowerCase().includes(q) && !a.developer.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [apps, filterStore, filterSeverity, filterStatus, filterSearch]);

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const rows = filtered.slice(startIdx, startIdx + pageSize);

  const cols: Column<MobileAppDisplay>[] = [
    {
      key: "name",
      header: "App",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: r.rogue ? "rgba(239,68,68,0.10)" : "linear-gradient(135deg, rgba(139,92,246,0.20), rgba(236,72,153,0.10))",
              border: `1px solid ${r.rogue ? "rgba(239,68,68,0.30)" : "rgba(139,92,246,0.30)"}`,
            }}>
            <Smartphone className={`w-4 h-4 ${r.rogue ? "text-red-300" : "text-purple-300"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-200 truncate">{r.title}</p>
            <p className="text-[10.5px] text-slate-500 font-mono truncate">{r.appId}</p>
          </div>
        </div>
      ),
    },
    { key: "store", header: "Store", render: (r) => <span className="text-[12px] text-slate-300">{r.store}</span> },
    { key: "developer", header: "Publisher", render: (r) => <span className="text-[12px] text-slate-400 truncate inline-block max-w-[200px]">{r.developer}</span> },
    {
      key: "lang",
      header: "Lang",
      render: (r) => <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tabular-nums"
        style={{ background: "rgba(168,85,247,0.10)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.30)" }}>{r.language}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      render: (r) => r.rating ? <span className="text-[12px] text-slate-300 tabular-nums">{r.rating}</span> : <span className="text-[11px] text-slate-600">—</span>,
    },
    {
      key: "installs",
      header: "Installs",
      align: "right",
      render: (r) => r.installs ? <span className="text-[11.5px] text-slate-400 tabular-nums">{r.installs}</span> : <span className="text-[11px] text-slate-600">—</span>,
    },
    {
      key: "perms",
      header: "Risky Permissions",
      render: (r) => {
        const risky = r.permissions.filter((p) => /SMS|CONTACTS|SYSTEM_ALERT|ACCESSIBILITY|RECORD_AUDIO|CAMERA|LOCATION/i.test(p))
          .map((p) => p.replace(/^android\.permission\./, ""));
        return risky.length ? <TagGroup tags={risky} max={3} /> : <span className="text-[11px] text-slate-600">—</span>;
      },
    },
    { key: "sev", header: "Severity", render: (r) => <SeverityBar level={r.severity} /> },
    {
      key: "status",
      header: "Status",
      render: (r) => r.rogue ? <StatusPill status="HIGH" /> : <StatusPill status="VERIFIED" />,
    },
    { key: "added", header: "Last Seen", render: (r) => <span className="text-[11px] text-slate-500">{r.added}</span> },
  ];

  const livePill = (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}>
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : `LIVE · ${apps.length} APPS DETECTED`}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Mobile Apps"
        description="Authorised mobile applications and rogue-app detections from Apify Google Play / App Store sweeps. Multilingual coverage across English, Hindi, and Kannada."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add App
          </button>
        }
      />
      <FilterCard onSearch={() => setPage(1)} onReset={() => { setFilterStore(""); setFilterSeverity(""); setFilterStatus(""); setFilterSearch(""); setPage(1); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterInput placeholder="App id / title / publisher" value={filterSearch} onChange={setFilterSearch} />
          <FilterSelect label="Store" options={["Google Play", "App Store"]} value={filterStore} onChange={setFilterStore} />
          <FilterSelect label="Severity" options={["Critical", "Substantial", "Moderate", "Low"]} value={filterSeverity} onChange={setFilterSeverity} />
          <FilterSelect label="Status" options={["Rogue", "Official"]} value={filterStatus} onChange={setFilterStatus} />
        </div>
      </FilterCard>
      <DataTable<MobileAppDisplay>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        emptyText={loading ? "Loading…" : "No mobile-app findings yet. Apify scans Google Play across en/hi/kn every 6h."}
      />
    </>
  );
}
