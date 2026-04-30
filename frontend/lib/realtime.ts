"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Resolve the active tenant id.
 *
 * MVP: localStorage["tai_tenant_id"] wins, falling back to
 * NEXT_PUBLIC_DEMO_TENANT_ID. Once auth is wired we'll swap this for a JWT
 * claim — the rest of the codebase only depends on the return value.
 */
export function useTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem("tai_tenant_id");
    } catch {
      // localStorage unavailable (SSR / sandboxed iframe). Fall through.
    }
    if (!id) {
      id = process.env.NEXT_PUBLIC_DEMO_TENANT_ID || null;
    }
    setTenantId(id);
  }, []);

  return tenantId;
}

interface LiveTableOpts {
  /** Postgres-REST style filter, e.g. `tenant_id=eq.abc` */
  filter?: string;
  /** Column to order by; defaults to created_at desc when present */
  orderBy?: string;
  /** Sort direction */
  ascending?: boolean;
  /** Cap row count returned to keep the table snappy. */
  limit?: number;
  /** Pause subscription/fetching until truthy (used while tenantId resolves). */
  enabled?: boolean;
}

interface LiveTableState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch a Supabase table once, then subscribe to postgres_changes for live
 * updates. Any insert/update/delete triggers a refetch — simple but correct.
 */
export function useLiveTable<T = Record<string, unknown>>(
  table: string,
  opts: LiveTableOpts = {}
): LiveTableState<T> {
  const { filter, orderBy = "created_at", ascending = false, limit = 500, enabled = true } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const fetchOnce = useCallback(async () => {
    if (!enabled) return;
    const supabase = supabaseRef.current;
    let query = supabase.from(table).select("*").limit(limit);
    if (orderBy) query = query.order(orderBy, { ascending });
    if (filter) {
      // Parse a simple `col=op.val` filter (eq, neq, in, is, gte, lte, like)
      const m = filter.match(/^([\w.]+)=([a-z]+)\.(.+)$/);
      if (m) {
        const [, col, op, valRaw] = m;
        const val: string | string[] = op === "in" ? valRaw.replace(/^\(|\)$/g, "").split(",") : valRaw;
        // Cast through unknown so TypeScript doesn't complain about the dynamic op
        query = (query as unknown as { filter: (c: string, o: string, v: unknown) => typeof query }).filter(col, op, val);
      }
    }
    const { data: rows, error: err } = await query;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setData((rows ?? []) as T[]);
    setError(null);
    setLoading(false);
  }, [table, filter, orderBy, ascending, limit, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchOnce();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`live:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          void fetchOnce();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, fetchOnce, table, filter]);

  return { data, loading, error, refetch: fetchOnce };
}

/* ── Convenience wrappers ─────────────────────────────────────────── */

export interface FindingRow {
  id: string;
  tenant_id: string;
  asset_id: string | null;
  scan_run_id: string | null;
  source: string;
  kind: string;
  severity: "Critical" | "Substantial" | "Moderate" | "Low";
  confidence: number | null;
  url_or_value: string | null;
  evidence: Record<string, unknown> | null;
  ai_filtered: boolean;
  ai_reason: string | null;
  recommended_action: string | null;
  created_at: string;
  // Apify v2 expansion fields (added 2026-04-30 migration)
  feature_id: string | null;
  apify_task_id: string | null;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  item_id: string | null;
  language_detected: string | null;
  fraud_pattern: string | null;
  engagement: Record<string, unknown> | null;
  matched_keywords: string[] | null;
  timestamp_source: string | null;
  needs_review: boolean | null;
  alert_sent: boolean | null;
}

export function useFindings(tenantId: string | null) {
  return useLiveTable<FindingRow>("findings", {
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    orderBy: "created_at",
    ascending: false,
    enabled: !!tenantId,
  });
}

export interface DlrRecordRow {
  id: string;
  tenant_id: string;
  scan_run_id: string | null;
  breach_name: string;
  data_classes: string[] | null;
  affected_email: string | null;
  status: "RECOVERED" | "WAITING" | "RECOVERY_FAILED";
  source: string;
  added_at: string;
}

export function useDlrRecords(tenantId: string | null) {
  return useLiveTable<DlrRecordRow>("dlr_records", {
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    orderBy: "added_at",
    ascending: false,
    enabled: !!tenantId,
  });
}

export interface ScanRunRow {
  id: string;
  tenant_id: string;
  brand: string | null;
  service: string;
  trigger: string | null;
  triggered_by: string | null;
  n8n_run_id: string | null;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  finding_count: number;
  payload: Record<string, unknown> | null;
  // Apify v2 expansion
  feature_id: string | null;
  apify_run_id: string | null;
  apify_task_id: string | null;
}

export function useScanRuns(tenantId: string | null) {
  return useLiveTable<ScanRunRow>("scan_runs", {
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    orderBy: "started_at",
    ascending: false,
    enabled: !!tenantId,
  });
}

/* ── Helpers shared by pages ──────────────────────────────────────── */

/** Pretty-print a kind enum into a Type label for the table. */
export function formatKind(kind: string | null | undefined): string {
  if (!kind) return "Unknown";
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Map AI's recommended_action to the existing UI status pill. */
export function actionToStatus(action: string | null | undefined): string {
  switch (action) {
    case "takedown":
      return "OPEN";
    case "monitor":
      return "WAITING";
    case "notify_user":
      return "WAITING";
    default:
      return "CLOSED";
  }
}

/** First 8 chars of a UUID — used as the human-readable case hash. */
export function shortHash(id: string | null | undefined): string {
  if (!id) return "--------";
  return id.replace(/-/g, "").slice(0, 8);
}
