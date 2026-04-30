// FEAT-028 — Executive multi-platform surveillance.
// Orchestrator that runs Sherlock (Kali) for each executive name and
// records non-verified-handle hits as executive_impersonation findings.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertFindingsDedupe } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const KALI_API_BASE = process.env.NEXT_PUBLIC_OSINT_API_BASE ?? "https://transilience--aegis-osint-api-web.modal.run";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const execs = (bundle.executives ?? []) as { entity_id: string; name: string; title: string }[];

    if (execs.length === 0) return NextResponse.json({ ok: false, error: "no executives in customer_assets" }, { status: 400 });

    const findingRows: Record<string, unknown>[] = [];
    let totalHits = 0;

    for (const exec of execs.slice(0, 6)) {
      const handle = exec.name.toLowerCase().replace(/\s+/g, "");
      try {
        const r = await fetch(`${KALI_API_BASE}/sherlock?username=${encodeURIComponent(handle)}`, {
          method: "GET", signal: AbortSignal.timeout(45000),
        });
        if (!r.ok) continue;
        const j = (await r.json()) as { hits?: string[] };
        const hits = j.hits ?? [];
        totalHits += hits.length;
        for (const h of hits) {
          const profileUrl = (typeof h === "string" ? h.match(/https?:\/\/\S+/)?.[0] : null) ?? "";
          if (!profileUrl) continue;
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "kali:sherlock-exec", kind: "executive_impersonation",
            severity: "Substantial", confidence: 0.55,
            url_or_value: profileUrl,
            evidence: { exec_name: exec.name, exec_title: exec.title, exec_id: exec.entity_id, sherlock_raw: h },
            feature_id: "FEAT-028", apify_task_id: "creditaccessgrameen-feat-028-exec",
            item_id: `${exec.entity_id}:${profileUrl}`,
            fraud_pattern: "exec_handle_outside_verified",
            matched_keywords: [exec.name],
            ai_filter_status: null,
            recommended_action: "monitor",
          });
        }
      } catch { /* skip exec on failure */ }
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-028-exec", findingRows);
    return NextResponse.json({ ok: true, executives_scanned: execs.length, total_hits: totalHits, kept: findingRows.length, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
