// FEAT-001 — Google Play rogue-app classifier.
// Triggered by n8n on the Apify ACTOR.RUN.SUCCEEDED webhook for a
// creditaccessgrameen-feat-001-google-play-{lang} task. Fetches the dataset,
// applies Part 6 detection rules, writes findings.
//
// Detection rules (Build Spec Part 6):
//   developer != "CreditAccess Grameen Limited" + brand kw in title/desc → HIGH
//   released < 30 days + brand kw                                        → CRITICAL
//   officialAppIds contains appId                                         → OFFICIAL (drop)
//   permissions ⊃ READ_SMS|READ_CONTACTS + brand kw                      → CRITICAL
//     (permission enrichment requires a follow-up "pe" actor run; not done
//      here — it's a separate FEAT-001b PR)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const APIFY_API = "https://api.apify.com/v2";

interface AppItem {
  appId?: string;
  id?: string;
  title?: string;
  description?: string;
  summary?: string;
  developer?: string;
  developerName?: string;
  developerId?: string;
  installs?: string;
  minInstalls?: number;
  score?: number;
  reviews?: number;
  ratings?: number;
  released?: string;
  updated?: string;
  free?: boolean;
  icon?: string;
  url?: string;
  permissions?: string[];
}

interface ClassifierAssetCtx {
  brand_keywords: string[];      // lowercase
  official_publisher: string;    // "CreditAccess Grameen Limited"
  official_app_ids: string[];    // ["com.creditaccessgrameen.mahi", ...]
  language: string;
}

const RECENT_DAYS_THRESHOLD = 30;
const HIGH_RISK_PERMS = ["READ_SMS", "READ_CONTACTS", "BIND_ACCESSIBILITY_SERVICE"];

function classifyApp(app: AppItem, ctx: ClassifierAssetCtx): {
  keep: boolean;
  severity?: "Critical" | "Substantial" | "Moderate" | "Low";
  kind?: string;
  fraud_pattern?: string;
  reason?: string;
  matched_keywords?: string[];
} {
  const appId = (app.appId || app.id || "").toLowerCase();
  const dev = (app.developer || app.developerName || "").trim();
  const title = (app.title || "").toLowerCase();
  const desc = (app.description || app.summary || "").toLowerCase();

  // Rule 0: official app — drop
  if (ctx.official_app_ids.includes(appId)) {
    return { keep: false, reason: "official appId" };
  }
  if (dev === ctx.official_publisher) {
    return { keep: false, reason: "official publisher" };
  }

  // Rule 1: brand-keyword match in title or description
  const hayfields = [title, desc];
  const matched = ctx.brand_keywords.filter((kw) => hayfields.some((h) => h.includes(kw)));
  if (matched.length === 0) {
    return { keep: false, reason: "no brand keyword in title/description" };
  }

  // Rule 2: high-risk permissions + brand kw → CRITICAL
  const perms = (app.permissions ?? []).map((p) => p.toUpperCase());
  if (perms.length > 0 && HIGH_RISK_PERMS.some((rp) => perms.some((p) => p.includes(rp)))) {
    return {
      keep: true, severity: "Critical", kind: "fake_mobile_app",
      fraud_pattern: "permission_red_flag_brand_match",
      reason: `Non-official developer "${dev}" + brand keyword "${matched[0]}" + high-risk permissions ${HIGH_RISK_PERMS.filter((rp) => perms.some((p) => p.includes(rp))).join(",")}.`,
      matched_keywords: matched,
    };
  }

  // Rule 3: recently released + brand kw → CRITICAL
  const releaseDate = app.released ? new Date(app.released) : null;
  const ageDays = releaseDate ? (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
  if (ageDays < RECENT_DAYS_THRESHOLD) {
    return {
      keep: true, severity: "Critical", kind: "fake_mobile_app",
      fraud_pattern: "recent_publish_brand_match",
      reason: `Non-official developer "${dev}" published ${Math.round(ageDays)} days ago + brand keyword "${matched[0]}".`,
      matched_keywords: matched,
    };
  }

  // Rule 4 default: brand kw + non-official dev → HIGH
  return {
    keep: true, severity: "Substantial", kind: "fake_mobile_app",
    fraud_pattern: "brand_keyword_non_official_dev",
    reason: `Non-official developer "${dev}" + brand keyword "${matched[0]}" in title/description.`,
    matched_keywords: matched,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      scan_run_id?: string;
      apify_dataset_id?: string;
      apify_run_id?: string;
      feature_id?: string;
      task_id?: string;
      language?: string;
    };

    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const featureId = body.feature_id ?? "FEAT-001";
    const datasetId = body.apify_dataset_id;
    if (!datasetId) {
      return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const apifyToken = process.env.APIFY_TOKEN!;

    // 1. Load classifier context from customer_assets
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const brand = (bundle.brand ?? {}) as { primary_name?: string; aliases?: string[]; product_brands?: string[]; misspellings?: string[] };
    const apps = (bundle.mobile_apps ?? {}) as { official_app_ids?: { play?: string[] }; google_play_publisher?: string };
    const brandKeywords = [
      brand.primary_name, ...(brand.aliases ?? []), ...(brand.product_brands ?? []), ...(brand.misspellings ?? []),
    ].filter((s): s is string => !!s).map((s) => s.toLowerCase());
    const ctx: ClassifierAssetCtx = {
      brand_keywords: brandKeywords,
      official_publisher: apps.google_play_publisher ?? "CreditAccess Grameen Limited",
      official_app_ids: apps.official_app_ids?.play ?? [],
      language: body.language ?? "en",
    };

    // 2. Fetch dataset from Apify
    const dsResp = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${apifyToken}&limit=1000`);
    if (!dsResp.ok) {
      return NextResponse.json({ ok: false, error: `dataset fetch ${dsResp.status}` }, { status: 502 });
    }
    const items = (await dsResp.json()) as AppItem[];

    // 3. Classify
    let kept = 0; let dropped = 0;
    const findingRows: Record<string, unknown>[] = [];
    for (const app of items) {
      const verdict = classifyApp(app, ctx);
      if (!verdict.keep) { dropped += 1; continue; }
      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-play", kind: verdict.kind ?? "fake_mobile_app",
        severity: verdict.severity, confidence: 0.7,
        url_or_value: app.url || `https://play.google.com/store/apps/details?id=${app.appId || app.id}`,
        evidence: {
          appId: app.appId || app.id, title: app.title, developer: app.developer || app.developerName,
          installs: app.installs || app.minInstalls, score: app.score,
          released: app.released, updated: app.updated,
          permissions: app.permissions,
        },
        feature_id: featureId, apify_task_id: body.task_id, apify_run_id: body.apify_run_id, apify_dataset_id: datasetId,
        item_id: app.appId || app.id || `${datasetId}:${kept}`,
        language_detected: ctx.language,
        fraud_pattern: verdict.fraud_pattern,
        matched_keywords: verdict.matched_keywords ?? [],
        ai_filter_status: null,         // attribution skill + AI filter run via /api/findings/ai-process
        recommended_action: null,
      });
      kept += 1;
    }

    // 4. Insert findings — manual dedup since PostgREST onConflict doesn't
    //    honor the partial unique index ux_findings_apify_dedup.
    //    Pre-filter rows whose (apify_task_id, item_id) already exists.
    let inserted = 0; let conflicts = 0;
    if (findingRows.length > 0) {
      const itemIds = findingRows.map((r) => r.item_id).filter(Boolean) as string[];
      const { data: existing } = await sb.from("findings")
        .select("item_id")
        .eq("apify_task_id", body.task_id ?? "")
        .in("item_id", itemIds);
      const existingIds = new Set((existing ?? []).map((r) => r.item_id));
      const toInsert = findingRows.filter((r) => !existingIds.has(r.item_id as string));
      conflicts = findingRows.length - toInsert.length;
      if (toInsert.length > 0) {
        const { error } = await sb.from("findings").insert(toInsert);
        if (error) {
          return NextResponse.json({ ok: false, error: `findings insert: ${error.message}`, items_seen: items.length }, { status: 500 });
        }
        inserted = toInsert.length;
      }
    }

    // 5. Mark scan_run completed
    if (body.scan_run_id) {
      await sb.from("scan_runs").update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        items_collected: items.length,
      }).eq("id", body.scan_run_id);
    }

    return NextResponse.json({
      ok: true,
      feature_id: featureId, scan_run_id: body.scan_run_id, language: ctx.language,
      items_seen: items.length, kept, dropped,
      inserted, deduped: conflicts,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
