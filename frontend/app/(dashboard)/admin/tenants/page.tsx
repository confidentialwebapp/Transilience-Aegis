"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

interface TenantRow {
  id: string;
  name: string;
  primary_brand: string | null;
  primary_domain: string | null;
  status: string | null;
  created_at: string;
  finding_count?: number;
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    const fetch = async () => {
      const { data: tdata } = await supabase
        .from("tenants")
        .select("id, name, primary_brand, primary_domain, status, created_at")
        .order("name");

      if (!tdata) {
        if (alive) {
          setTenants([]);
          setLoading(false);
        }
        return;
      }

      // Pull finding counts grouped by tenant_id (single round-trip)
      const ids = tdata.map((t) => t.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: countRows } = await supabase
          .from("findings")
          .select("tenant_id, id")
          .in("tenant_id", ids);
        counts = (countRows ?? []).reduce<Record<string, number>>((acc, r) => {
          if (r.tenant_id) acc[r.tenant_id] = (acc[r.tenant_id] ?? 0) + 1;
          return acc;
        }, {});
      }

      if (alive) {
        setTenants(
          tdata.map((t) => ({ ...(t as TenantRow), finding_count: counts[t.id] ?? 0 }))
        );
        setLoading(false);
      }
    };
    void fetch();
    const channel = supabase
      .channel("tenants-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, () => void fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "findings" }, () => void fetch())
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const needle = search.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        (t.primary_brand ?? "").toLowerCase().includes(needle) ||
        (t.primary_domain ?? "").toLowerCase().includes(needle)
    );
  }, [tenants, search]);

  const cols: Column<TenantRow>[] = [
    {
      key: "name",
      header: "Tenant",
      render: (r) => (
        <Link href={`/admin/tenants/${r.id}`} className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11.5px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
          >
            {r.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200 group-hover:text-purple-200">{r.name}</p>
            <p className="text-[10.5px] text-slate-500">{r.primary_brand ?? "—"}</p>
          </div>
        </Link>
      ),
    },
    { key: "domain", header: "Primary Domain", render: (r) => <span className="text-[12px] text-purple-300 font-mono">{r.primary_domain ?? "—"}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={(r.status ?? "ACTIVE").toUpperCase()} />,
    },
    {
      key: "findings",
      header: "Findings",
      align: "right",
      render: (r) => <span className="text-[12px] font-bold text-emerald-400 tabular-nums">{r.finding_count ?? 0}</span>,
    },
    {
      key: "created",
      header: "Created",
      render: (r) => <span className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every customer organisation onboarded to the platform. Click into a tenant to manage assets and trigger scans."
        rightSlot={
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white opacity-60 cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
            title="Add Tenant flow not yet implemented"
          >
            <Plus className="w-3 h-3" /> Add Tenant
          </button>
        }
      />

      <FilterCard onSearch={() => {}} onReset={() => setSearch("")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FilterInput
            icon={Building2}
            placeholder="Search tenant name, brand, or domain"
            value={search}
            onChange={setSearch}
          />
        </div>
      </FilterCard>

      <DataTable<TenantRow>
        columns={cols}
        rows={filtered}
        totalEntries={filtered.length}
        rowAction={false}
        emptyText={loading ? "Loading tenants…" : "No tenants yet — seed one in Supabase or via the migration."}
      />
    </>
  );
}
