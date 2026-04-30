// FEAT-031 — Search-engine dork discovery.
// Consumes a Google Search SERP dataset where queries were Google dorks
// (site:owned-domain inurl:admin / intext:password / etc.). Reports
// exposed-admin-panel / .env / backup hits.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx, isOwnedDomain } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SerpItem {
  url?: string; title?: string; description?: string;
  searchQuery?: string; query?: string;
}

const SENSITIVE_PATH_PATTERNS = [
  { rx: /\.env(?:\.|$)|\.env\.example/i,        label: "env_file_exposed", sev: "Critical" as const },
  { rx: /\/wp-admin|\/admin\/?(?:\?|$)|\/administrator\b/i, label: "admin_panel_exposed", sev: "Critical" as const },
  { rx: /\.git\/(?:config|HEAD)|\.gitignore$/i, label: "git_dir_exposed", sev: "Critical" as const },
  { rx: /\/backup|\/dump|\.sql\b|\.bak$/i,      label: "backup_file_exposed", sev: "Critical" as const },
  { rx: /\.htaccess$|\/wp-config\.php/i,        label: "config_file_exposed", sev: "Critical" as const },
  { rx: /phpmyadmin|adminer\.php/i,             label: "db_admin_exposed", sev: "Critical" as const },
  { rx: /\/api\/(swagger|docs|graphql)\b/i,     label: "api_docs_exposed", sev: "Substantial" as const },
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as SerpItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const url = it.url || "";
      if (!url) { dropped += 1; continue; }
      let host = "";
      try { host = new URL(url).hostname.toLowerCase(); } catch { dropped += 1; continue; }
      // Only report when the URL is on an OWNED domain — otherwise it's
      // someone else's misconfig, not our problem.
      if (!isOwnedDomain(host, ctx.owned_domains)) { dropped += 1; continue; }

      const text = `${url} ${it.title ?? ""}`;
      const hits = SENSITIVE_PATH_PATTERNS.filter((p) => p.rx.test(text));
      if (hits.length === 0) { dropped += 1; continue; }
      const top = hits[0];

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-search-dorks", kind: "fake_login_page",
        severity: top.sev, confidence: 0.85,
        url_or_value: url,
        evidence: { url, title: it.title, description: it.description, query: it.searchQuery || it.query, hits: hits.map((h) => h.label) },
        feature_id: "FEAT-031", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url,
        fraud_pattern: top.label,
        matched_keywords: hits.map((h) => h.label),
        ai_filter_status: null,
        recommended_action: "investigate",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
