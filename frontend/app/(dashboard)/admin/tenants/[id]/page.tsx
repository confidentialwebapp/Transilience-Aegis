"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Zap, Package, History, Search, Globe } from "lucide-react";
import { PageHeader, StatusPill, EmptyState, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useLiveTable, type ScanRunRow, type FindingRow, formatKind, shortHash } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
  id: string;
  name: string;
  primary_brand: string | null;
  primary_domain: string | null;
  status: string | null;
  created_at: string;
}

interface TenantService {
  service: string;
  active: boolean;
  limit_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
}

const SERVICE_LABELS: Record<string, string> = {
  brand_monitoring: "Brand Monitoring",
  social_media_monitoring: "Social Media Monitoring",
  mobile_app_monitoring: "Mobile App Monitoring",
  domain_monitoring: "Domain Monitoring",
  dark_web_monitoring: "Dark Web Monitoring",
  messaging_suite: "MessagingSuite",
  url_scan_suite: "URL Scan Suite",
  dns_suite: "DNS Suite",
  intellicode_copyid: "intelliCODE-copyiD",
  weblogic_saas: "weblogic SaaS",
  wss: "Website Scanning Suite",
  incident_response: "Incident Response",
  accessibility: "Accessibility",
};

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params.id;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<TenantService[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: scanRuns } = useLiveTable<ScanRunRow>("scan_runs", {
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    orderBy: "started_at",
    ascending: false,
    limit: 10,
    enabled: !!tenantId,
  });

  const { data: findings } = useLiveTable<FindingRow>("findings", {
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    orderBy: "created_at",
    ascending: false,
    limit: 20,
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", tenantId).single(),
        supabase.from("tenant_services").select("*").eq("tenant_id", tenantId),
      ]);
      if (!alive) return;
      setTenant(t as Tenant | null);
      setServices((s ?? []) as TenantService[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-3 max-w-5xl">
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: "rgba(139,92,246,0.10)" }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <>
        <Link href="/admin/tenants" className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-purple-300 mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to tenants
        </Link>
        <EmptyState title="Tenant not found." />
      </>
    );
  }

  const runCols: Column<ScanRunRow>[] = [
    {
      key: "started",
      header: "Started",
      render: (r) => <span className="text-[11px] text-slate-400 font-mono">{new Date(r.started_at).toLocaleString()}</span>,
    },
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <Link href={`/admin/runs/${r.id}`} className="text-[12px] font-semibold text-purple-300 hover:text-purple-200">
          {r.brand ?? shortHash(r.id)}
        </Link>
      ),
    },
    { key: "service", header: "Service", render: (r) => <span className="text-[11.5px] text-slate-400">{r.service}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status.toUpperCase()} /> },
    {
      key: "findings",
      header: "Findings",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.finding_count}</span>,
    },
  ];

  const findingCols: Column<FindingRow>[] = [
    {
      key: "kind",
      header: "Kind",
      render: (r) => <span className="text-[12px] text-slate-300">{formatKind(r.kind)}</span>,
    },
    { key: "severity", header: "Severity", render: (r) => <StatusPill status={r.severity?.toUpperCase() ?? "UNKNOWN"} /> },
    {
      key: "url",
      header: "URL / Value",
      render: (r) => (
        <span className="text-[11.5px] text-purple-300 truncate max-w-[420px] inline-block">{r.url_or_value ?? "—"}</span>
      ),
    },
    {
      key: "created",
      header: "Found",
      render: (r) => <span className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleString()}</span>,
    },
  ];

  return (
    <>
      <Link href="/admin/tenants" className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-purple-300 mb-3 transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back to tenants
      </Link>

      <PageHeader
        title={tenant.name}
        description={tenant.primary_brand ? `${tenant.primary_brand} · ${tenant.primary_domain ?? ""}` : tenant.primary_domain ?? "—"}
        rightSlot={
          <Link
            href={`/admin/scan?tenant_id=${tenant.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
          >
            <Zap className="w-3 h-3" /> Run Brand Sweep
          </Link>
        }
      />

      {/* Profile card */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl p-4 mb-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <Field label="Tenant ID" value={<span className="font-mono text-[11px]">{tenant.id}</span>} />
        <Field label="Status" value={<StatusPill status={(tenant.status ?? "ACTIVE").toUpperCase()} />} />
        <Field
          label="Primary Domain"
          value={tenant.primary_domain ? (
            <span className="flex items-center gap-1 text-[12px] font-mono text-purple-300">
              <Globe className="w-3 h-3" /> {tenant.primary_domain}
            </span>
          ) : <span className="text-slate-500">—</span>}
        />
        <Field
          label="Created"
          value={<span className="text-[12px] text-slate-300">{new Date(tenant.created_at).toLocaleDateString()}</span>}
        />
      </div>

      {/* Services */}
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <Package className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400">Active Services</span>
          <span className="text-[10px] text-slate-500">({services.filter((s) => s.active).length} of {services.length})</span>
        </div>
        {services.length === 0 ? (
          <div className="p-4 text-[12px] text-slate-500 italic">No services configured.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {services.map((s) => (
              <div
                key={s.service}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: s.active ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${s.active ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.08)"}`,
                }}
              >
                <span className={`w-2 h-2 rounded-full ${s.active ? "bg-emerald-400" : "bg-slate-600"}`} />
                <span className={`text-[12px] flex-1 ${s.active ? "text-slate-200 font-semibold" : "text-slate-500"}`}>
                  {SERVICE_LABELS[s.service] ?? s.service}
                </span>
                {s.limit_value != null && (
                  <span className="text-[9.5px] text-slate-500">limit: {s.limit_value}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div className="mb-4">
        <h3 className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-2 flex items-center gap-2">
          <History className="w-3 h-3" /> Recent scan runs
        </h3>
        <DataTable<ScanRunRow>
          columns={runCols}
          rows={scanRuns}
          totalEntries={scanRuns.length}
          rowAction={false}
          emptyText="No scan runs for this tenant yet."
        />
      </div>

      {/* Recent findings */}
      <div>
        <h3 className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-2 flex items-center gap-2">
          <Search className="w-3 h-3" /> Recent findings
        </h3>
        <DataTable<FindingRow>
          columns={findingCols}
          rows={findings}
          totalEntries={findings.length}
          rowAction={false}
          emptyText="No findings yet — trigger a scan to populate."
        />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-[0.13em] text-slate-500 font-bold">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}
