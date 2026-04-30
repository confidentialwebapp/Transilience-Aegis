// FEAT-003 — Third-party APK site monitoring.
// Phase 1: on-demand classifier that takes APK URLs from APKMirror /
// APKPure / Aptoide / APKCombo / Uptodown / GetAPK and analyzes via
// the Modal Kali endpoint (apksigner verify, apkleaks, mobsfscan).
//
// Custom Apify actor (tai-aegis/apk-site-monitor) is a Phase 2
// optimization for autonomous discovery; for Phase 1, admin pastes
// candidate URLs (or FEAT-007 SERP discovers them) and this route
// classifies them.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const KALI_API_BASE = process.env.NEXT_PUBLIC_OSINT_API_BASE ?? "https://transilience--aegis-osint-api-web.modal.run";

const APK_HOSTS = [
  "apkmirror.com", "apkpure.com", "aptoide.com",
  "apkcombo.com", "uptodown.com", "getapk.com",
];

interface ApkClassifyInput {
  tenant_id?: string;
  apk_urls?: string[];
  feature_id?: string;
  scan_run_id?: string;
}

interface ApkAnalysis {
  url: string;
  on_known_apk_host: boolean;
  brand_in_path: boolean;
  matched_keywords: string[];
  signing_cert_match?: boolean | null;
  red_flag_perms?: string[];
}

const HIGH_RISK_PERMS = ["READ_SMS", "READ_CONTACTS", "BIND_ACCESSIBILITY_SERVICE", "SYSTEM_ALERT_WINDOW"];

function analyzeUrl(url: string, brandKeywords: string[]): ApkAnalysis {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
  const path = url.toLowerCase();
  const onHost = APK_HOSTS.some((h) => host.endsWith(h));
  const matched = brandKeywords.filter((kw) => path.includes(kw));
  return { url, on_known_apk_host: onHost, brand_in_path: matched.length > 0, matched_keywords: matched };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ApkClassifyInput;
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const urls = (body.apk_urls ?? []).filter(Boolean);
    if (urls.length === 0) {
      return NextResponse.json({ ok: false, error: "apk_urls required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Brand keywords from customer_assets
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const brand = (bundle.brand ?? {}) as { primary_name?: string; aliases?: string[]; product_brands?: string[] };
    const apps = (bundle.mobile_apps ?? {}) as { official_apk_signing_cert_sha256?: string };
    const officialCert = apps.official_apk_signing_cert_sha256?.startsWith("TBD_") ? "" : (apps.official_apk_signing_cert_sha256 ?? "").toLowerCase();

    const brandKeywords = [
      brand.primary_name, ...(brand.aliases ?? []), ...(brand.product_brands ?? []),
    ].filter((s): s is string => !!s).map((s) => s.toLowerCase());

    const findingRows: Record<string, unknown>[] = [];
    const analyses: ApkAnalysis[] = [];

    for (const u of urls) {
      const a = analyzeUrl(u, brandKeywords);
      analyses.push(a);
      if (!a.on_known_apk_host || !a.brand_in_path) continue;

      // Optional Kali enrichment: try apksigner via the Modal endpoint.
      // Endpoint may not exist yet — best effort, don't block on failure.
      let signing_match: boolean | null = null;
      try {
        const r = await fetch(`${KALI_API_BASE}/apksigner?url=${encodeURIComponent(u)}`, { method: "GET", signal: AbortSignal.timeout(15000) });
        if (r.ok) {
          const j = (await r.json()) as { sha256?: string };
          if (officialCert && j.sha256) {
            signing_match = j.sha256.toLowerCase() === officialCert;
          }
        }
      } catch { /* enrichment best-effort */ }
      a.signing_cert_match = signing_match;

      // Severity decision
      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "third_party_apk_brand_host_match";
      let reason = `Third-party APK site (${new URL(u).hostname}) hosts file with brand keyword "${a.matched_keywords[0]}" in URL`;

      if (signing_match === false) {
        severity = "Critical";
        fraudPattern = "third_party_apk_signing_mismatch";
        reason += `; APK signing cert SHA256 does NOT match the official ${officialCert.slice(0, 8)}...`;
      } else if (officialCert && signing_match === null) {
        reason += `; signing cert lookup unavailable`;
      } else if (signing_match === true) {
        // Genuine APK redistributed — drop or low severity
        continue;
      }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:apk-site", kind: "fake_mobile_app",
        severity, confidence: 0.65,
        url_or_value: u,
        evidence: { url: u, host: new URL(u).hostname, signing_cert_match: signing_match, official_cert_sha256: officialCert || null },
        feature_id: "FEAT-003", apify_task_id: "creditaccessgrameen-feat-003-on-demand", item_id: u,
        language_detected: "en", fraud_pattern: fraudPattern,
        matched_keywords: a.matched_keywords,
        ai_filter_status: null, recommended_action: null,
      });
    }

    let inserted = 0;
    if (findingRows.length > 0) {
      const itemIds = findingRows.map((r) => r.item_id) as string[];
      const { data: existing } = await sb.from("findings").select("item_id")
        .eq("apify_task_id", "creditaccessgrameen-feat-003-on-demand").in("item_id", itemIds);
      const existingIds = new Set((existing ?? []).map((r) => r.item_id));
      const toInsert = findingRows.filter((r) => !existingIds.has(r.item_id as string));
      if (toInsert.length > 0) {
        const { error } = await sb.from("findings").insert(toInsert);
        if (error) return NextResponse.json({ ok: false, error: `insert: ${error.message}` }, { status: 500 });
        inserted = toInsert.length;
      }
    }

    return NextResponse.json({
      ok: true, urls_seen: urls.length, kept: findingRows.length, inserted,
      analyses, official_cert_configured: officialCert !== "",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
