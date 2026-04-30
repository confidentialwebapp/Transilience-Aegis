// FEAT-022 — Defacement detection on owned sites.
// Per Build Spec Part 6: hourly scrape critical pages, compute DOM hash,
// alert on drift outside maintenance windows + new external scripts.
//
// Phase 1: on-demand check that fetches each critical page, hashes
// computed against a Supabase-stored baseline (kv_state table or
// customer_assets metadata), reports drift.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DefaceReport {
  url: string;
  status?: number;
  hash?: string;
  baseline_hash?: string;
  drift?: boolean;
  scripts?: string[];
  external_scripts?: string[];
  iframe_count?: number;
  fetch_error?: string;
}

const ALLOWED_SCRIPT_HOSTS = [
  "googletagmanager.com", "google-analytics.com", "googleadservices.com",
  "cloudflare.com", "cloudflareinsights.com", "fbcdn.net", "facebook.com",
  "linkedin.com", "twimg.com", "creditaccessgrameen.in", "grameenkoota.in",
];

async function checkPage(url: string, baseline?: string): Promise<DefaceReport> {
  const out: DefaceReport = { url };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow" });
    out.status = r.status;
    if (!r.ok) { out.fetch_error = `HTTP ${r.status}`; return out; }
    const html = await r.text();

    // DOM hash: strip noise (comments, datetime tokens, csrf nonces) for stable hashing
    const stripped = html.replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g, "")
      .replace(/_token=[a-f0-9]+/gi, "")
      .replace(/\s+/g, " ");
    out.hash = createHash("sha256").update(stripped).digest("hex");
    out.baseline_hash = baseline;
    out.drift = baseline !== undefined && baseline !== "" && out.hash !== baseline;

    // Script src inventory
    const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    out.scripts = scriptMatches.map((m) => m[1]).slice(0, 50);
    out.external_scripts = out.scripts.filter((s) => {
      try {
        const u = new URL(s, url);
        if (u.hostname === new URL(url).hostname) return false;
        return !ALLOWED_SCRIPT_HOSTS.some((h) => u.hostname.endsWith(h));
      } catch { return false; }
    });

    out.iframe_count = (html.match(/<iframe\b/gi) ?? []).length;
  } catch (e) {
    out.fetch_error = (e as Error).message;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      pages?: string[];   // optional override; defaults to owned-domain home + login
      baselines?: Record<string, string>;
      scan_run_id?: string;
    };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const pages = body.pages?.length ? body.pages : ctx.owned_domains.flatMap((d) => [`https://${d}/`, `https://${d}/login`]);

    const reports = await Promise.all(pages.map((p) => checkPage(p, body.baselines?.[p])));

    const findingRows: Record<string, unknown>[] = [];
    for (const r of reports) {
      if (r.fetch_error) {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:defacement", kind: "fake_login_page",
          severity: "Substantial", confidence: 0.7,
          url_or_value: r.url,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-022", apify_task_id: "creditaccessgrameen-feat-022-defacement",
          item_id: `${r.url}:fetch_error`,
          fraud_pattern: "owned_site_unreachable",
          recommended_action: "investigate",
          matched_keywords: [],
        });
        continue;
      }
      if (r.drift) {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:defacement", kind: "fake_login_page",
          severity: "Critical", confidence: 0.85,
          url_or_value: r.url,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-022", apify_task_id: "creditaccessgrameen-feat-022-defacement",
          item_id: `${r.url}:dom_drift`,
          fraud_pattern: "dom_hash_drift",
          recommended_action: "investigate",
          matched_keywords: [],
        });
      }
      if ((r.external_scripts ?? []).length > 0) {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:defacement", kind: "fake_login_page",
          severity: "Critical", confidence: 0.85,
          url_or_value: r.url,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-022", apify_task_id: "creditaccessgrameen-feat-022-defacement",
          item_id: `${r.url}:foreign_script`,
          fraud_pattern: "foreign_script_injection",
          recommended_action: "investigate",
          matched_keywords: r.external_scripts ?? [],
        });
      }
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-022-defacement", findingRows);
    return NextResponse.json({ ok: true, reports, kept: findingRows.length, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
