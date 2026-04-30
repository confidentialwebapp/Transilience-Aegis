"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, FileText } from "lucide-react";
import { PageHeader, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { useLiveTable } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  payload: Record<string, unknown> | null;
  at: string;
}

interface AdminUserRow {
  user_id: string;
  email: string;
}

export default function AdminAuditPage() {
  const { data: rows, loading } = useLiveTable<AuditRow>("audit_log", {
    orderBy: "at",
    ascending: false,
    limit: 100,
  });

  const [adminUsers, setAdminUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("admin_users").select("user_id, email");
      if (!alive || !data) return;
      const map: Record<string, string> = {};
      (data as AdminUserRow[]).forEach((r) => {
        map[r.user_id] = r.email;
      });
      setAdminUsers(map);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cols: Column<AuditRow>[] = useMemo(
    () => [
      {
        key: "at",
        header: "When",
        render: (r) => (
          <span className="text-[11.5px] text-slate-300 font-mono tabular-nums">
            {new Date(r.at).toLocaleString()}
          </span>
        ),
      },
      {
        key: "actor",
        header: "Actor",
        render: (r) => (
          <span className="text-[12px] text-slate-300">
            {r.actor_id ? adminUsers[r.actor_id] ?? r.actor_id.slice(0, 8) : "system"}
          </span>
        ),
      },
      {
        key: "action",
        header: "Action",
        render: (r) => (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(168,85,247,0.10)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.25)" }}
          >
            {r.action}
          </span>
        ),
      },
      {
        key: "target",
        header: "Target",
        render: (r) => <span className="text-[11.5px] font-mono text-slate-400">{r.target ?? "—"}</span>,
      },
      {
        key: "payload",
        header: "Payload",
        render: (r) => (
          <span className="text-[10.5px] text-slate-500 font-mono truncate max-w-[420px] inline-block">
            {r.payload ? JSON.stringify(r.payload).slice(0, 220) : "—"}
          </span>
        ),
      },
    ],
    [adminUsers]
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
          style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.30)" }}
        >
          <Activity className="w-2.5 h-2.5 animate-pulse" />
          {loading ? "LIVE · CONNECTING…" : `LIVE · ${rows.length} ENTRIES`}
        </span>
      </div>

      <PageHeader
        title="Audit Log"
        description="Every admin mutation, in order. Live-streamed from Supabase. The last 100 events are shown here; everything is retained server-side."
      />

      <DataTable<AuditRow>
        columns={cols}
        rows={rows}
        totalEntries={rows.length}
        rowAction={false}
        emptyText={
          loading
            ? "Connecting to audit feed…"
            : "No audit entries yet. Mutations from the admin console will appear here."
        }
      />

      <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] text-slate-500" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Audit entries are written by the server when admin actions take place (tenant create, scan trigger, service toggle, etc). Service-role mutations write here automatically via Track F's triggers.
        </span>
      </div>
    </>
  );
}
