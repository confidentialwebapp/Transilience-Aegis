"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldOff, CheckCircle2, XCircle, Mail, Globe } from "lucide-react";
import { PageHeader, KPICard, StatusPill, TagPill, FilterCard, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

interface TakedownDraft {
  id: string;
  tenant_id: string;
  finding_id: string;
  status: string;
  provider: string;
  abuse_url: string;
  draft_body: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  findings?: { severity?: string; source?: string; url_or_value?: string; ai_summary?: string };
}

const PROVIDER_ICONS: Record<string, typeof Globe> = {
  google_play: Globe, app_store: Globe, apk_host: Globe,
  cloudflare: Globe, registrar: Globe, manual: Mail,
};

const CA_GRAMEEN = "23610954-5fd0-482f-8eb0-11edce1f5c58";

export default function TakedownsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<TakedownDraft[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const r = await fetch(`/api/admin/takedowns?tenant_id=${CA_GRAMEEN}`);
      const j = await r.json();
      if (!alive) return;
      setRows((j.drafts ?? []) as TakedownDraft[]);
      setLoading(false);
    };
    void fetchAll();
    const ch = supabase.channel("admin:takedowns")
      .on("postgres_changes", { event: "*", schema: "public", table: "takedown_drafts" }, () => void fetchAll())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [supabase]);

  const decide = async (id: string, action: "approve" | "reject") => {
    await fetch("/api/admin/takedowns", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, decided_by: "admin" }),
    });
  };

  const filtered = filterStatus ? rows.filter(r => r.status === filterStatus) : rows;
  const counts = {
    total: rows.length,
    pending: rows.filter(r => r.status === "draft").length,
    approved: rows.filter(r => r.status === "approved").length,
    submitted: rows.filter(r => r.status === "submitted" || r.status === "succeeded").length,
  };

  const cols: Column<TakedownDraft>[] = [
    { key: "abuse", header: "Target", render: (r) => (
      <div className="leading-snug">
        <p className="text-[12.5px] font-mono font-semibold text-slate-200 truncate max-w-[420px]">{r.abuse_url}</p>
        {r.findings?.ai_summary && <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-2">{r.findings.ai_summary}</p>}
      </div>
    )},
    { key: "provider", header: "Provider", render: (r) => <TagPill label={r.provider} /> },
    { key: "severity", header: "Severity", render: (r) => r.findings?.severity ? <StatusPill status={r.findings.severity.toUpperCase()} /> : <span className="text-slate-500 text-[11px]">—</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status.toUpperCase()} /> },
    { key: "decided_at", header: "Decided", render: (r) => <span className="text-[10.5px] text-slate-500">{r.decided_at ? `${new Date(r.decided_at).toLocaleString()} (${r.decided_by})` : "—"}</span> },
    { key: "actions", header: "", render: (r) => r.status === "draft" ? (
      <div className="flex gap-1">
        <button onClick={() => decide(r.id, "approve")} className="px-2 py-1 rounded text-[10.5px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> approve
        </button>
        <button onClick={() => decide(r.id, "reject")} className="px-2 py-1 rounded text-[10.5px] font-bold bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-500/30 inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" /> reject
        </button>
        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="px-2 py-1 rounded text-[10.5px] text-slate-300 border border-slate-700 hover:bg-slate-800">
          {expanded === r.id ? "hide" : "view"}
        </button>
      </div>
    ) : (
      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="px-2 py-1 rounded text-[10.5px] text-slate-300 border border-slate-700 hover:bg-slate-800">
        {expanded === r.id ? "hide" : "view"}
      </button>
    )},
  ];

  return (
    <>
      <PageHeader
        title="Takedown Drafts"
        description="Auto-generated abuse-report drafts from Critical-severity findings with recommended_action=takedown. Phase 1 mode: admin approves each draft before any external submission."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Total drafts" value={counts.total} accent="purple" icon={ShieldOff} />
        <KPICard label="Pending review" value={counts.pending} accent="amber" />
        <KPICard label="Approved" value={counts.approved} accent="green" />
        <KPICard label="Submitted" value={counts.submitted} accent="blue" />
      </div>
      <FilterCard collapsible={false}>
        <FilterSelect label="Status" options={["draft", "approved", "rejected", "submitted", "succeeded", "failed"]}
          value={filterStatus} onChange={setFilterStatus} />
      </FilterCard>
      <DataTable<TakedownDraft>
        columns={cols} rows={filtered} rowAction={false}
        emptyText={loading ? "Loading…" : "No takedown drafts. Drafts appear when findings have severity=Critical AND recommended_action=takedown."}
      />
      {expanded && (() => {
        const r = rows.find(x => x.id === expanded);
        if (!r) return null;
        return (
          <div className="mt-4 p-4 rounded-lg border border-purple-500/40 bg-slate-900/60">
            <h4 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Draft body — {r.provider}</h4>
            <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">{r.draft_body}</pre>
          </div>
        );
      })()}
    </>
  );
}
