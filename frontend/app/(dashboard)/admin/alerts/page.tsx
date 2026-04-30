"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Send, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { PageHeader, KPICard, StatusPill, TagPill, FilterCard, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

const CA_GRAMEEN = "23610954-5fd0-482f-8eb0-11edce1f5c58";

interface AlertRow {
  alert_id: string;
  tenant_id: string;
  finding_id: string;
  channel: string;
  priority: string;
  rule_matched: string;
  severity: string;
  status: string;
  delivered_at: string | null;
  delivery_status: string | null;
  payload: { summary?: string; source?: string; url?: string; risk_score?: number };
}

export default function AlertsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", channel: "", priority: "" });
  const [delivering, setDelivering] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const { data } = await supabase.from("alerts").select("*").order("alert_id", { ascending: false }).limit(200);
      if (!alive) return;
      setRows((data ?? []) as AlertRow[]);
      setLoading(false);
    };
    void fetchAll();
    const ch = supabase.channel("admin:alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void fetchAll())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [supabase]);

  const deliverPending = async () => {
    setDelivering(true);
    const r = await fetch("/api/alerts/deliver", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: CA_GRAMEEN, max: 50 }),
    });
    const j = await r.json();
    setDelivering(false);
    alert(`Processed ${j.processed} alerts: ${j.sent} sent, ${j.failed} failed.\n\nSample failures:\n${(j.sample_failures || []).join("\n")}`);
  };

  const filtered = rows.filter((r) =>
    (!filter.status || r.status === filter.status) &&
    (!filter.channel || r.channel === filter.channel) &&
    (!filter.priority || r.priority === filter.priority));

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
    p1: rows.filter((r) => r.priority === "p1").length,
  };

  const cols: Column<AlertRow>[] = [
    { key: "summary", header: "Alert", render: (r) => (
      <div className="leading-snug max-w-[420px]">
        <p className="text-[12.5px] font-semibold text-slate-200 truncate">{r.payload.summary ?? r.rule_matched}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <TagPill label={r.rule_matched} />
          {r.payload.source && <TagPill label={r.payload.source} />}
          {r.payload.risk_score !== undefined && <span className="text-[10px] text-slate-500 tabular-nums">risk={r.payload.risk_score}</span>}
        </div>
      </div>
    )},
    { key: "priority", header: "Priority", render: (r) => <StatusPill status={r.priority.toUpperCase()} /> },
    { key: "severity", header: "Severity", render: (r) => <StatusPill status={r.severity.toUpperCase()} /> },
    { key: "channel", header: "Channel", render: (r) => <TagPill label={r.channel} /> },
    { key: "status", header: "Status", render: (r) => (
      <div>
        <StatusPill status={r.status.toUpperCase()} />
        {r.status === "failed" && r.delivery_status && (
          <p className="text-[9.5px] text-red-300 mt-0.5 truncate max-w-[200px]" title={r.delivery_status}>{r.delivery_status}</p>
        )}
      </div>
    )},
    { key: "delivered_at", header: "Delivered", render: (r) => <span className="text-[10.5px] text-slate-500">{r.delivered_at ? new Date(r.delivered_at).toLocaleString() : "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Outbound alert deliveries (Slack / email / PagerDuty / SIEM). Generated from kept findings via the alert_routing_rules engine. Channels need their corresponding env vars set on Vercel: SLACK_WEBHOOK_URL_SOC_CRITICAL, SENDGRID_API_KEY, PAGERDUTY_INTEGRATION_KEY, SIEM_WEBHOOK_URL."
        actions={
          <button onClick={deliverPending} disabled={delivering || counts.pending === 0}
            className={`px-3 py-1.5 text-[12px] rounded inline-flex items-center gap-1.5 font-semibold border ${counts.pending > 0 ? "bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border-purple-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
            {delivering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Deliver pending ({counts.pending})
          </button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Pending" value={counts.pending} accent="amber" icon={Bell} />
        <KPICard label="Sent" value={counts.sent} accent="green" icon={CheckCircle2} />
        <KPICard label="Failed" value={counts.failed} accent="red" icon={AlertTriangle} />
        <KPICard label="P1 priority" value={counts.p1} accent="purple" />
      </div>
      <FilterCard collapsible={false}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterSelect label="Status" options={["pending","sent","failed","acknowledged","suppressed"]} value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} />
          <FilterSelect label="Channel" options={["slack","email","pagerduty","siem"]} value={filter.channel} onChange={(v) => setFilter({ ...filter, channel: v })} />
          <FilterSelect label="Priority" options={["p0","p1","p2","p3","p4"]} value={filter.priority} onChange={(v) => setFilter({ ...filter, priority: v })} />
        </div>
      </FilterCard>
      <DataTable<AlertRow> columns={cols} rows={filtered} rowAction={false}
        emptyText={loading ? "Loading…" : "No alerts. Alerts get inserted when ai-process commits findings + the alert_routing_rules engine matches."}
      />
    </>
  );
}
