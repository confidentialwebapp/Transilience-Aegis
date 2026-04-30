"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, AlertTriangle, DollarSign, TrendingUp, Pause, Play, Zap } from "lucide-react";
import { PageHeader, KPICard, FilterCard, FilterSelect, DataTable, StatusPill, TagPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

interface ScheduleRow {
  id: string;
  tenant_id: string;
  feature_id: string;
  cadence: string;
  enabled: boolean;
  apify_schedule_id: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
}

interface CostGuard {
  today_spend: number;
  month_spend: number;
  cap: number;
  cap_remaining: number;
  forecast: { burn_rate_per_day: number; projected_month_total: number; days_left_in_month: number };
}

const CADENCE_OPTIONS = ["manual", "hourly", "every_4h", "every_6h", "every_12h", "daily", "weekly"];

const FEATURE_LABELS: Record<string, string> = {
  "FEAT-001": "Google Play rogue apps", "FEAT-002": "App Store rogue apps",
  "FEAT-003": "Third-party APK sites",  "FEAT-004": "Phishing URL analyzer",
  "FEAT-005": "Lookalike domain discovery", "FEAT-006": "Domain classifier",
  "FEAT-007": "Brand SERP monitoring",  "FEAT-019": "WHOIS / DNS / SSL bulk",
  "FEAT-020": "DMARC / SPF / DKIM check","FEAT-022": "Defacement detection",
  "FEAT-023": "IR page integrity",
};

const CA_GRAMEEN = "23610954-5fd0-482f-8eb0-11edce1f5c58";

export default function SchedulesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [guard, setGuard] = useState<CostGuard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const [s, g] = await Promise.all([
        fetch(`/api/admin/schedules?tenant_id=${CA_GRAMEEN}`).then(r => r.json()),
        fetch(`/api/admin/cost-guard?tenant_id=${CA_GRAMEEN}`).then(r => r.json()),
      ]);
      if (!alive) return;
      setRows((s.schedules ?? []) as ScheduleRow[]);
      setGuard(g.guard ?? null);
      setLoading(false);
    };
    void fetchAll();
    const ch = supabase.channel("admin:schedules")
      .on("postgres_changes", { event: "*", schema: "public", table: "scan_schedules" }, () => void fetchAll())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [supabase]);

  const toggle = async (row: ScheduleRow) => {
    await fetch("/api/admin/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: CA_GRAMEEN, feature_id: row.feature_id, enabled: !row.enabled }),
    });
  };
  const setCadence = async (row: ScheduleRow, cadence: string) => {
    await fetch("/api/admin/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: CA_GRAMEEN, feature_id: row.feature_id, cadence }),
    });
  };
  const runNow = async (row: ScheduleRow) => {
    const taskId = `creditaccessgrameen-${row.feature_id.toLowerCase().replace("feat-0", "feat-")}`;
    const res = await fetch("/api/admin/scan/full-sweep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: CA_GRAMEEN, feature_id: row.feature_id, apify_task_id: taskId, run_kali: false }),
    });
    const j = await res.json();
    if (j.ok) alert(`Scan queued. scan_run_id=${j.scan_run_id?.slice(0, 8)} apify_run_id=${j.apify_run_id ?? "—"}`);
    else alert(`Refused: ${j.error}`);
  };

  const cols: Column<ScheduleRow>[] = [
    { key: "feature", header: "Feature", render: (r) => (
      <div>
        <p className="text-[12.5px] font-mono font-semibold text-purple-300">{r.feature_id}</p>
        <p className="text-[10.5px] text-slate-400">{FEATURE_LABELS[r.feature_id] ?? "(unknown)"}</p>
      </div>
    )},
    { key: "cadence", header: "Cadence", render: (r) => (
      <select value={r.cadence} onChange={(e) => setCadence(r, e.target.value)}
        className="text-[11px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 font-mono">
        {CADENCE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    )},
    { key: "enabled", header: "Status", render: (r) => <StatusPill status={r.enabled ? "ENABLED" : "DISABLED"} /> },
    { key: "last_run", header: "Last run", render: (r) => (
      <span className="text-[11px] text-slate-500">
        {r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "never"}
        {r.last_run_status && <TagPill label={r.last_run_status} />}
      </span>
    )},
    { key: "actions", header: "", render: (r) => (
      <div className="flex items-center gap-1.5">
        <button onClick={() => runNow(r)} className="px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 text-[10.5px] font-bold inline-flex items-center gap-1">
          <Zap className="w-3 h-3" /> Run Now
        </button>
        <button onClick={() => toggle(r)} className={`px-2 py-1 rounded text-[10.5px] font-bold inline-flex items-center gap-1 border ${r.enabled ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30" : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/30"}`}>
          {r.enabled ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Enable</>}
        </button>
      </div>
    )},
  ];

  const burnPct = guard ? (guard.month_spend / guard.cap) * 100 : 0;
  const projectedPct = guard ? (guard.forecast.projected_month_total / guard.cap) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Scan Schedules"
        description="Per-feature scan cadences for CreditAccess Grameen. All schedules disabled by default — Apify Starter ($29/mo cap). Enable per-feature when ready."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Spend today" value={guard ? `$${guard.today_spend.toFixed(2)}` : "—"} accent="blue" icon={DollarSign} />
        <KPICard label="Spend this month" value={guard ? `$${guard.month_spend.toFixed(2)} / $${guard.cap}` : "—"} accent={burnPct > 86 ? "red" : burnPct > 60 ? "amber" : "green"} icon={TrendingUp} />
        <KPICard label="Cap remaining" value={guard ? `$${guard.cap_remaining.toFixed(2)}` : "—"} accent="purple" />
        <KPICard label="Projected (this month)" value={guard ? `$${guard.forecast.projected_month_total.toFixed(2)}` : "—"} accent={projectedPct > 100 ? "red" : "amber"} icon={AlertTriangle} />
      </div>
      {guard && projectedPct > 100 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[12px]">
          <strong>⚠ Projected to exceed cap.</strong> Burn rate of ${guard.forecast.burn_rate_per_day.toFixed(2)}/day with {guard.forecast.days_left_in_month} days left projects ${guard.forecast.projected_month_total.toFixed(2)} for the month vs. cap of ${guard.cap}. Disable some schedules or increase to Scale tier.
        </div>
      )}
      <DataTable<ScheduleRow>
        columns={cols}
        rows={rows}
        rowAction={false}
        emptyText={loading ? "Loading…" : "No schedules. Run schema migration to bootstrap."}
      />
    </>
  );
}
