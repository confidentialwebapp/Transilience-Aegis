"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Workflow, Activity, Zap, ExternalLink, Pause, Play, Search as SearchIcon, AlertCircle } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, KPICard, Toggle, TagPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

interface ApifyTask {
  task_id: string;
  tenant_id: string;
  feature_id: string;
  feature_label: string | null;
  language: string | null;
  actor_id: string;
  schedule_cron: string | null;
  proxy_group: string | null;
  proxy_country: string | null;
  active: boolean;
  created_at: string;
}

interface ApifyRun {
  run_id: string;
  tenant_id: string;
  feature_id: string | null;
  task_id: string | null;
  trigger: string | null;
  started_at: string;
  finished_at: string | null;
  items: number | null;
  cost_usd: number | null;
  compute_units: number | null;
  status: string | null;
}

const FEATURE_TO_PATH: Record<string, string> = {
  "FEAT-001": "feat-001",
  "FEAT-007": "feat-007-tier1",
  "FEAT-019": "feat-019",
  "FEAT-022": "feat-022",
  "FEAT-024": "feat-024",
  "FEAT-026": "feat-026",
};

export default function ApifyConsolePage() {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<ApifyTask[]>([]);
  const [runs, setRuns] = useState<ApifyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFeatureFilter, setTaskFeatureFilter] = useState("");
  const [runStatusFilter, setRunStatusFilter] = useState("");
  const [runFeatureFilter, setRunFeatureFilter] = useState("");

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const [t, r] = await Promise.all([
        supabase.from("apify_tasks").select("*").order("feature_id"),
        supabase.from("apify_runs").select("*").order("started_at", { ascending: false }).limit(100),
      ]);
      if (!alive) return;
      setTasks((t.data ?? []) as ApifyTask[]);
      setRuns((r.data ?? []) as ApifyRun[]);
      setLoading(false);
    };
    void fetchAll();
    const tasksCh = supabase.channel("admin:apify_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "apify_tasks" }, () => void fetchAll())
      .subscribe();
    const runsCh = supabase.channel("admin:apify_runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "apify_runs" }, () => void fetchAll())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(tasksCh); void supabase.removeChannel(runsCh); };
  }, [supabase]);

  // KPI values
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todaySpend = runs.filter((r) => new Date(r.started_at) >= today).reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const monthSpend = runs.filter((r) => new Date(r.started_at) >= thisMonth).reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const activeTasks = tasks.filter((t) => t.active).length;
  const failed24h = runs.filter((r) => new Date(r.started_at) >= last24h && (r.status === "FAILED" || r.status === "TIMED-OUT")).length;

  const togglePause = async (taskId: string, current: boolean) => {
    await supabase.from("apify_tasks").update({ active: !current }).eq("task_id", taskId);
  };

  // last run per task
  const lastRunByTask = useMemo(() => {
    const m: Record<string, ApifyRun> = {};
    for (const r of runs) {
      if (r.task_id && !m[r.task_id]) m[r.task_id] = r;
    }
    return m;
  }, [runs]);

  const filteredTasks = useMemo(() => tasks.filter((t) => {
    if (taskSearch && !t.task_id.toLowerCase().includes(taskSearch.toLowerCase()) && !(t.feature_label ?? "").toLowerCase().includes(taskSearch.toLowerCase())) return false;
    if (taskFeatureFilter && t.feature_id !== taskFeatureFilter) return false;
    return true;
  }), [tasks, taskSearch, taskFeatureFilter]);

  const filteredRuns = useMemo(() => runs.filter((r) => {
    if (runStatusFilter && r.status !== runStatusFilter) return false;
    if (runFeatureFilter && r.feature_id !== runFeatureFilter) return false;
    return true;
  }), [runs, runStatusFilter, runFeatureFilter]);

  const taskCols: Column<ApifyTask>[] = [
    {
      key: "task",
      header: "Task ID / Feature",
      render: (t) => (
        <div>
          <p className="text-[11.5px] font-mono text-purple-300 truncate max-w-[280px]">{t.task_id}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TagPill label={t.feature_id} />
            {t.language && <span className="text-[10px] text-slate-500 uppercase">{t.language}</span>}
          </div>
          <p className="text-[10.5px] text-slate-500 mt-0.5">{t.feature_label}</p>
        </div>
      ),
    },
    { key: "actor", header: "Actor", render: (t) => <span className="text-[11px] text-slate-400 font-mono">{t.actor_id}</span> },
    { key: "cron", header: "Schedule", render: (t) => <span className="text-[11px] text-slate-300 font-mono">{t.schedule_cron ?? "—"}</span> },
    {
      key: "proxy",
      header: "Proxy",
      render: (t) => <span className="text-[11px] text-slate-400">{t.proxy_group} / {t.proxy_country ?? "—"}</span>,
    },
    {
      key: "lastrun",
      header: "Last Run",
      render: (t) => {
        const r = lastRunByTask[t.task_id];
        if (!r) return <span className="text-[11px] text-slate-600">—</span>;
        return (
          <div>
            <p className="text-[11px] text-slate-400">{new Date(r.started_at).toLocaleString()}</p>
            <p className="text-[10px] text-slate-500">{r.status} · {r.items ?? 0} items</p>
          </div>
        );
      },
    },
    {
      key: "active",
      header: "Active",
      render: (t) => <Toggle on={t.active} onChange={() => togglePause(t.task_id, t.active)} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/scan?tenant_id=${t.tenant_id}&feature_id=${t.feature_id}`}
            className="px-2 py-1 rounded text-[10.5px] font-semibold text-purple-300 hover:text-white"
            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)" }}
          >
            <Zap className="w-3 h-3 inline mr-1" /> Run
          </Link>
          <a
            href={`https://console.apify.com/actors/tasks/${encodeURIComponent(t.task_id)}`}
            target="_blank" rel="noopener noreferrer"
            className="px-2 py-1 rounded text-[10.5px] font-semibold text-slate-300 hover:text-white"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.15)" }}
          >
            <ExternalLink className="w-3 h-3 inline mr-1" /> Apify
          </a>
        </div>
      ),
    },
  ];

  const runCols: Column<ApifyRun>[] = [
    { key: "started", header: "Started", render: (r) => <span className="text-[11px] text-slate-400">{new Date(r.started_at).toLocaleString()}</span> },
    { key: "feature", header: "Feature", render: (r) => r.feature_id ? <TagPill label={r.feature_id} /> : <span className="text-[11px] text-slate-600">—</span> },
    { key: "task", header: "Task", render: (r) => <span className="text-[11px] font-mono text-slate-400 truncate inline-block max-w-[260px]">{r.task_id ?? "—"}</span> },
    { key: "trigger", header: "Trigger", render: (r) => <span className="text-[11px] text-slate-400">{r.trigger ?? "—"}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status ?? "UNKNOWN"} /> },
    { key: "items", header: "Items", align: "right", render: (r) => <span className="text-[11px] text-slate-300 tabular-nums">{r.items ?? 0}</span> },
    { key: "cu", header: "CUs", align: "right", render: (r) => <span className="text-[11px] text-slate-400 tabular-nums">{(r.compute_units ?? 0).toFixed(4)}</span> },
    { key: "cost", header: "Cost", align: "right", render: (r) => <span className="text-[11px] text-amber-300 tabular-nums">${(r.cost_usd ?? 0).toFixed(3)}</span> },
    { key: "fin", header: "Finished", render: (r) => r.finished_at ? <span className="text-[11px] text-slate-500">{new Date(r.finished_at).toLocaleString()}</span> : <span className="text-[11px] text-amber-400">running…</span> },
  ];

  const featureOptions = Array.from(new Set(tasks.map((t) => t.feature_id))).sort();

  return (
    <>
      <PageHeader
        title="Apify Console"
        description="Per-customer Apify Task ledger, schedule status, recent runs, and live cost tracking. Manage individual Tasks here or trigger ad-hoc runs from /admin/scan."
      />

      <div
        className="rounded-xl p-3 mb-4 flex items-start gap-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)" }}
      >
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-amber-200">
          Tasks below are seeded in Supabase but not yet provisioned on Apify-side. Run <code className="text-amber-100 px-1 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>apify/provision.sh</code> with a Scale-tier API token to create the actual Tasks + Schedules + Webhooks on apify.com.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Today's Spend" value={`$${todaySpend.toFixed(2)}`} accent="amber" />
        <KPICard label="This Month" value={`$${monthSpend.toFixed(2)}`} accent="purple" />
        <KPICard label="Active Tasks" value={activeTasks} accent="green" icon={Workflow} />
        <KPICard label="Failed (24h)" value={failed24h} accent={failed24h > 0 ? "red" : "slate"} />
      </div>

      <h3 className="text-[12px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-2">Tasks ({filteredTasks.length})</h3>
      <FilterCard collapsible={false}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput icon={SearchIcon} placeholder="Search task or label" value={taskSearch} onChange={setTaskSearch} />
          <FilterSelect label="Feature" options={featureOptions} value={taskFeatureFilter} onChange={setTaskFeatureFilter} />
        </div>
      </FilterCard>
      <DataTable<ApifyTask>
        columns={taskCols}
        rows={filteredTasks}
        rowAction={false}
        emptyText={loading ? "Loading…" : "No Apify Tasks. Apply migration 20260430_apify_v2.sql to seed."}
      />

      <h3 className="text-[12px] font-bold tracking-[0.13em] uppercase text-slate-400 mt-6 mb-2">Recent Runs ({filteredRuns.length})</h3>
      <FilterCard collapsible={false}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect label="Feature" options={featureOptions} value={runFeatureFilter} onChange={setRunFeatureFilter} />
          <FilterSelect label="Status" options={["SUCCEEDED", "RUNNING", "FAILED", "TIMED-OUT", "ABORTED"]} value={runStatusFilter} onChange={setRunStatusFilter} />
        </div>
      </FilterCard>
      <DataTable<ApifyRun>
        columns={runCols}
        rows={filteredRuns}
        rowAction={false}
        emptyText={loading ? "Loading…" : "No runs yet. Trigger one from /admin/scan."}
      />
    </>
  );
}
