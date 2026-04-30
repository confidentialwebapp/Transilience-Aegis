"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, FileBadge, ArrowLeft, Activity, Clock } from "lucide-react";
import { PageHeader, StatusPill, DataTable, EmptyState } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useLiveTable, type ScanRunRow, type FindingRow, formatKind, shortHash } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const N8N_WORKFLOW_BASE = "https://transilience--aegis-n8n-server.modal.run/workflow";

function ElapsedTimer({ start }: { start: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const startMs = new Date(start).getTime();
  const sec = Math.max(0, Math.floor((now - startMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className="font-mono tabular-nums text-amber-300">
      {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

export default function AdminRunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<ScanRunRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to this single run for live status updates
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const supabase = createClient();
    const fetchRun = async () => {
      const { data } = await supabase.from("scan_runs").select("*").eq("id", runId).single();
      if (alive) {
        setRun(data as ScanRunRow | null);
        setLoading(false);
      }
    };
    void fetchRun();
    const ch = supabase
      .channel(`run:${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_runs", filter: `id=eq.${runId}` },
        () => void fetchRun()
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [runId]);

  // Live findings for this run
  const { data: findings } = useLiveTable<FindingRow>("findings", {
    filter: `scan_run_id=eq.${runId}`,
    orderBy: "created_at",
    ascending: false,
    enabled: !!runId,
  });

  if (loading) {
    return (
      <div className="space-y-3 max-w-5xl">
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: "rgba(139,92,246,0.10)" }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }} />
      </div>
    );
  }

  if (!run) {
    return (
      <>
        <Link href="/admin/runs" className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-purple-300 mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to runs
        </Link>
        <EmptyState title="Scan run not found." />
      </>
    );
  }

  const cols: Column<FindingRow>[] = [
    {
      key: "kind",
      header: "Kind",
      render: (r) => <span className="text-[12px] text-slate-300">{formatKind(r.kind)}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      render: (r) => <StatusPill status={r.severity?.toUpperCase() ?? "UNKNOWN"} />,
    },
    {
      key: "url",
      header: "URL / Value",
      render: (r) => (
        <a
          href={r.url_or_value?.startsWith("http") ? r.url_or_value : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11.5px] text-purple-300 hover:text-purple-200 truncate max-w-[400px] inline-block"
        >
          {r.url_or_value ?? "—"}
        </a>
      ),
    },
    {
      key: "reason",
      header: "AI reason",
      render: (r) => (
        <span className="text-[10.5px] text-slate-500 italic max-w-[260px] inline-block truncate">
          {r.ai_reason ?? "—"}
        </span>
      ),
    },
    {
      key: "conf",
      header: "Conf.",
      align: "right",
      render: (r) => (
        <span className="text-[11px] text-slate-400 tabular-nums font-mono">
          {r.confidence != null ? r.confidence.toFixed(2) : "—"}
        </span>
      ),
    },
  ];

  const isRunning = run.status === "running" || run.status === "queued";
  const completedDuration =
    run.completed_at && run.started_at
      ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1) + "s"
      : null;

  return (
    <>
      <Link href="/admin/runs" className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-purple-300 mb-3 transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back to runs
      </Link>

      <PageHeader
        title={`Run · ${run.brand ?? shortHash(run.id)}`}
        description="Live status of this scan run and the findings produced."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Status" value={<StatusPill status={run.status.toUpperCase()} />} />
        <Stat
          label="Elapsed"
          value={
            isRunning ? (
              <ElapsedTimer start={run.started_at} />
            ) : completedDuration ? (
              <span className="font-mono tabular-nums">{completedDuration}</span>
            ) : (
              <span className="text-slate-500">—</span>
            )
          }
        />
        <Stat label="Findings" value={<span className="font-bold text-emerald-400 tabular-nums">{run.finding_count}</span>} />
        <Stat
          label="Service"
          value={<span className="text-slate-300 text-[12px]">{run.service}</span>}
        />
      </div>

      {/* Action row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {run.n8n_run_id && (
          <a
            href={`${N8N_WORKFLOW_BASE}/${run.n8n_run_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-200 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.20)" }}
          >
            <ExternalLink className="w-3 h-3" /> View execution in n8n
          </a>
        )}
        <a
          href={`/api/report/${run.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
        >
          <FileBadge className="w-3 h-3" /> Generate PDF report
        </a>
      </div>

      {/* Payload */}
      <div className="mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-2 flex items-center gap-2">
          <Clock className="w-3 h-3" /> Payload
        </h3>
        <pre
          className="rounded-xl p-4 text-[11px] text-slate-300 font-mono overflow-x-auto"
          style={{ background: "#0a0610", border: "1px solid rgba(139,92,246,0.15)" }}
        >
          {JSON.stringify(run.payload ?? {}, null, 2)}
        </pre>
      </div>

      {/* Findings */}
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-2 flex items-center gap-2">
          <Activity className={cn("w-3 h-3", isRunning && "text-emerald-400 animate-pulse")} />
          Findings ({findings.length})
        </h3>
        <DataTable<FindingRow>
          columns={cols}
          rows={findings}
          totalEntries={findings.length}
          rowAction={false}
          emptyText={isRunning ? "Scan running — findings appear live as n8n produces them." : "No findings produced for this run."}
        />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <p className="text-[9.5px] uppercase tracking-[0.13em] text-slate-500 font-bold">{label}</p>
      <div className="mt-1 text-[14px] font-bold text-white">{value}</div>
    </div>
  );
}
