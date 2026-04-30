"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Activity, Search, DollarSign, Zap, Users, History, ArrowRight, ExternalLink, Workflow } from "lucide-react";
import { PageHeader, KPICard } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

const N8N_EXEC_URL = "https://transilience--aegis-n8n-server.modal.run/executions";

interface Counts {
  tenants: number;
  activeScans: number;
  findingsToday: number;
  apifySpend: number;
  loading: boolean;
}

function useAdminCounts(): Counts {
  const [counts, setCounts] = useState<Counts>({
    tenants: 0,
    activeScans: 0,
    findingsToday: 0,
    apifySpend: 0,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    const refetch = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [tenantsRes, runsRes, findingsRes, apifyRes] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("scan_runs").select("id", { count: "exact", head: true }).eq("status", "running"),
        supabase
          .from("findings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("apify_runs")
          .select("cost_usd")
          .gte("started_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const apifySpend =
        (apifyRes.data ?? []).reduce((sum, r: { cost_usd: number | null }) => sum + (r.cost_usd ?? 0), 0) ?? 0;

      if (!alive) return;
      setCounts({
        tenants: tenantsRes.count ?? 0,
        activeScans: runsRes.count ?? 0,
        findingsToday: findingsRes.count ?? 0,
        apifySpend,
        loading: false,
      });
    };

    refetch();
    const ch = supabase
      .channel("admin-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "scan_runs" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "findings" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, refetch)
      .subscribe();

    return () => {
      alive = false;
      ch.unsubscribe();
    };
  }, []);

  return counts;
}

export default function AdminIndexPage() {
  const counts = useAdminCounts();

  return (
    <>
      <PageHeader
        title="Admin Console"
        description="Operational control plane — trigger scans, manage tenants, view live execution."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPICard
          label="Total Tenants"
          value={counts.loading ? "…" : counts.tenants}
          accent="purple"
          icon={Building2}
        />
        <KPICard
          label="Active Scans"
          value={counts.loading ? "…" : counts.activeScans}
          accent={counts.activeScans > 0 ? "amber" : "slate"}
          icon={Activity}
        />
        <KPICard
          label="Findings Today"
          value={counts.loading ? "…" : counts.findingsToday}
          accent="green"
          icon={Search}
        />
        <KPICard
          label="Apify Spend (30d)"
          value={counts.loading ? "…" : `$${counts.apifySpend.toFixed(2)}`}
          accent="blue"
          icon={DollarSign}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <ActionCard
          href="/admin/scan"
          title="Run brand sweep"
          description="Kick off an OSINT scan for a tenant. Findings appear live within ~60 seconds."
          icon={Zap}
        />
        <ActionCard
          href="/admin/tenants"
          title="Manage tenants"
          description="Add, edit, or suspend tenants. Configure their assets and active services."
          icon={Users}
        />
        <ActionCard
          href="/admin/runs"
          title="Scan run history"
          description="Audit-trail of every scan, status, and resulting finding count."
          icon={History}
        />
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "rgba(139,92,246,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <Workflow className="w-3.5 h-3.5 text-purple-300" />
            <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400">
              n8n Executions — Live
            </span>
          </div>
          <a
            href={N8N_EXEC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="p-3">
          <p className="text-[11px] text-slate-500 mb-2">
            You may be prompted to log in to n8n separately (cross-origin auth). Username:{" "}
            <span className="text-purple-300 font-mono">admin</span>.
          </p>
          <iframe
            src={N8N_EXEC_URL}
            className="w-full rounded-lg"
            style={{ height: 500, background: "#0a0610", border: "1px solid rgba(139,92,246,0.15)" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl p-4 flex items-start gap-3 transition-all hover:border-purple-500/30"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}
      >
        <Icon className="w-5 h-5 text-purple-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-200 group-hover:text-white">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-300 mt-1 flex-shrink-0" />
    </Link>
  );
}
