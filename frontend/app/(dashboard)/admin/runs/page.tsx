"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useLiveTable, type ScanRunRow } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
  id: string;
  name: string;
}

export default function AdminRunsPage() {
  const { data: runs, loading } = useLiveTable<ScanRunRow>("scan_runs", {
    orderBy: "started_at",
    ascending: false,
    limit: 500,
  });

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filterTenant, setFilterTenant] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("tenants").select("id, name").order("name");
      if (alive && data) setTenants(data as Tenant[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tenantById = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tenants]);

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (filterTenant && r.tenant_id !== filterTenant) return false;
      if (filterStatus && r.status !== filterStatus.toLowerCase()) return false;
      return true;
    });
  }, [runs, filterTenant, filterStatus]);

  const cols: Column<ScanRunRow>[] = [
    {
      key: "started",
      header: "Started",
      render: (r) => (
        <span className="text-[11.5px] text-slate-300 font-mono tabular-nums">
          {new Date(r.started_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (r) => <span className="text-[12px] text-slate-300">{tenantById.get(r.tenant_id) ?? r.tenant_id.slice(0, 8)}</span>,
    },
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <Link href={`/admin/runs/${r.id}`} className="text-[12.5px] font-semibold text-purple-300 hover:text-purple-200">
          {r.brand ?? "—"}
        </Link>
      ),
    },
    {
      key: "service",
      header: "Service",
      render: (r) => <span className="text-[11.5px] text-slate-400">{r.service}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status.toUpperCase()} />,
    },
    {
      key: "findings",
      header: "Findings",
      align: "right",
      render: (r) => (
        <span className={`text-[12px] font-bold tabular-nums ${r.finding_count > 0 ? "text-emerald-400" : "text-slate-500"}`}>
          {r.finding_count}
        </span>
      ),
    },
    {
      key: "trigger",
      header: "Trigger",
      render: (r) => <span className="text-[11px] text-slate-500">{r.trigger ?? "—"}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
          style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}
        >
          <Activity className="w-2.5 h-2.5 animate-pulse" />
          {loading ? "LIVE · CONNECTING…" : `LIVE · ${runs.length} RUNS`}
        </span>
      </div>

      <PageHeader title="Scan Run History" description="Every scan run, live-updated. Click a brand to drill into per-run findings and the n8n execution log." />

      <FilterCard
        onSearch={() => {}}
        onReset={() => {
          setFilterTenant("");
          setFilterStatus("");
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterSelect
            label="Tenant"
            value={filterTenant}
            onChange={setFilterTenant}
            options={tenants.map((t) => t.name)}
          />
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={["queued", "running", "completed", "failed"]}
          />
        </div>
      </FilterCard>

      <DataTable<ScanRunRow>
        columns={cols}
        rows={filtered}
        totalEntries={filtered.length}
        rowAction={false}
        emptyText={loading ? "Connecting to Supabase…" : "No scan runs yet. Trigger one from /admin/scan."}
      />
    </>
  );
}
