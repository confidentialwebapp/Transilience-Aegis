// FEAT-002 — Apple App Store rogue-app classifier.
// Same Part 6 detection rules as FEAT-001 adapted for App Store fields.
// App Store responses don't expose Android-style permissions, so the
// permission-red-flag rule is replaced with a "category mismatch" rule
// (e.g., entertainment app posing as a finance app).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const APIFY_API = "https://api.apify.com/v2";

interface AppStoreItem {
  id?: number | string;
  bundleId?: string;
  appId?: string;
  trackId?: number | string;
  trackName?: string;
  title?: string;
  artistName?: string;
  developer?: string;
  sellerName?: string;
  description?: string;
  primaryGenreName?: string;
  genres?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
  releaseDate?: string;
  currentVersionReleaseDate?: string;
  trackViewUrl?: string;
  url?: string;
  free?: boolean;
  price?: number;
}

interface ClassifierCtx {
  brand_keywords: string[];
  official_publisher: string;
  official_app_ids: string[];
  apple_developer_id: string;
  language: string;
}

const RECENT_DAYS_THRESHOLD = 30;
const FINANCE_GENRES = ["Finance", "Business", "Productivity"];

function classifyApp(app: AppStoreItem, ctx: ClassifierCtx): {
  keep: boolean;
  severity?: "Critical" | "Substantial" | "Moderate" | "Low";
  kind?: string;
  fraud_pattern?: string;
  reason?: string;
  matched_keywords?: string[];
} {
  const bundleId = (app.bundleId || app.appId || "").toLowerCase();
  const dev = (app.developer || app.artistName || app.sellerName || "").trim();
  const title = (app.trackName || app.title || "").toLowerCase();
  const desc = (app.description || "").toLowerCase();
  const primaryGenre = app.primaryGenreName ?? "";

  // Rule 0: official app — drop
  if (ctx.official_app_ids.some((id) => id && bundleId.includes(id.toLowerCase()))) {
    return { keep: false, reason: "official bundleId" };
  }
  if (dev === ctx.official_publisher || (ctx.apple_developer_id && dev === ctx.apple_developer_id)) {
    return { keep: false, reason: "official publisher" };
  }

  // Rule 1: brand keyword in title or description
  const matched = ctx.brand_keywords.filter((kw) => title.includes(kw) || desc.includes(kw));
  if (matched.length === 0) {
    return { keep: false, reason: "no brand keyword in title/description" };
  }

  // Rule 2: category mismatch + brand kw — finance brand promoted in non-finance category
  const inFinanceCategory = FINANCE_GENRES.includes(primaryGenre);
  if (matched.length > 0 && !inFinanceCategory && primaryGenre) {
    return {
      keep: true, severity: "Critical", kind: "fake_mobile_app",
      fraud_pattern: "category_mismatch_brand_match",
      reason: `Brand "${matched[0]}" appears in non-finance App Store category "${primaryGenre}" by "${dev}".`,
      matched_keywords: matched,
    };
  }

  // Rule 3: recent release + brand kw → CRITICAL
  const releaseStr = app.releaseDate ?? app.currentVersionReleaseDate;
  if (releaseStr) {
    const ageDays = (Date.now() - new Date(releaseStr).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < RECENT_DAYS_THRESHOLD) {
      return {
        keep: true, severity: "Critical", kind: "fake_mobile_app",
        fraud_pattern: "recent_publish_brand_match",
        reason: `Non-official developer "${dev}" published ${Math.round(ageDays)} days ago + brand keyword "${matched[0]}".`,
        matched_keywords: matched,
      };
    }
  }

  // Rule 4 default
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
    const featureId = body.feature_id ?? "FEAT-002";
    const datasetId = body.apify_dataset_id;
    if (!datasetId) {
      return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const apifyToken = process.env.APIFY_TOKEN!;

    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const brand = (bundle.brand ?? {}) as { primary_name?: string; aliases?: string[]; product_brands?: string[]; misspellings?: string[] };
    const apps = (bundle.mobile_apps ?? {}) as {
      official_app_ids?: { play?: string[]; appstore?: string[] };
      google_play_publisher?: string;
      apple_developer_id?: string;
    };
    const appstoreIds = apps.official_app_ids?.appstore?.filter((s) => s && !s.startsWith("TBD_")) ?? [];
    const appleDevId = apps.apple_developer_id?.startsWith("TBD_") ? "" : (apps.apple_developer_id ?? "");

    const brandKeywords = [
      brand.primary_name, ...(brand.aliases ?? []), ...(brand.product_brands ?? []), ...(brand.misspellings ?? []),
    ].filter((s): s is string => !!s).map((s) => s.toLowerCase());
    const ctx: ClassifierCtx = {
      brand_keywords: brandKeywords,
      official_publisher: apps.google_play_publisher ?? "CreditAccess Grameen Limited",
      official_app_ids: appstoreIds,
      apple_developer_id: appleDevId,
      language: body.language ?? "en",
    };

    const dsResp = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${apifyToken}&limit=1000`);
    if (!dsResp.ok) {
      return NextResponse.json({ ok: false, error: `dataset fetch ${dsResp.status}` }, { status: 502 });
    }
    const items = (await dsResp.json()) as AppStoreItem[];

    let kept = 0; let dropped = 0;
    const findingRows: Record<string, unknown>[] = [];
    for (const app of items) {
      const verdict = classifyApp(app, ctx);
      if (!verdict.keep) { dropped += 1; continue; }
      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:app-store", kind: verdict.kind ?? "fake_mobile_app",
        severity: verdict.severity, confidence: 0.7,
        url_or_value: app.trackViewUrl || app.url || `https://apps.apple.com/in/app/${app.bundleId || app.id}`,
        evidence: {
          bundleId: app.bundleId, trackId: app.trackId, title: app.trackName || app.title,
          developer: app.developer || app.artistName || app.sellerName,
          genre: app.primaryGenreName, ratings: app.userRatingCount, score: app.averageUserRating,
          released: app.releaseDate, updated: app.currentVersionReleaseDate,
        },
        feature_id: featureId, apify_task_id: body.task_id, apify_run_id: body.apify_run_id, apify_dataset_id: datasetId,
        item_id: String(app.bundleId || app.id || `${datasetId}:${kept}`),
        language_detected: ctx.language,
        fraud_pattern: verdict.fraud_pattern,
        matched_keywords: verdict.matched_keywords ?? [],
        ai_filter_status: null,
        recommended_action: null,
      });
      kept += 1;
    }

    let inserted = 0; let conflicts = 0;
    if (findingRows.length > 0) {
      const itemIds = findingRows.map((r) => r.item_id).filter(Boolean) as string[];
      const { data: existing } = await sb.from("findings")
        .select("item_id").eq("apify_task_id", body.task_id ?? "").in("item_id", itemIds);
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

    if (body.scan_run_id) {
      await sb.from("scan_runs").update({
        status: "succeeded", finished_at: new Date().toISOString(), items_collected: items.length,
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
