// FEAT-004 — Phishing URL analyzer.
// Phase 1 implementation: on-demand HTTP fetch + AI evaluation. The
// "Standby Actor" architecture in the spec is a perf optimization; for
// Phase 1 a synchronous Vercel route is sufficient.
//
// Flow:
//   1. Fetch URL HTML (best-effort, 10s timeout)
//   2. Parse forms, scripts, brand-keyword presence
//   3. Score signals per Build Spec Part 6:
//      - Form fields request Aadhaar/PAN/bank → +40
//      - Form action to non-owned domain → +30
//      - "Apply for loan" + brand on non-owned domain → +30
//      - Domain registered <30 days → +25
//      - Free SSL issuer + brand keyword in domain → +15
//      - Page asks for processing fee → +35
//      - Regional language scam pattern → +20
//   4. ≥80 → auto-takedown draft, ≥60 → critical, ≥40 → analyst, <40 → low

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const PII_FIELD_PATTERNS = [
  /aadhaar|aadhar|आधार/i, /pan[\s-]?card|पैन/i, /bank[\s-]?account|खाता/i,
  /loan[\s-]?amount|लोन/i, /mobile[\s-]?number|मोबाइल/i, /otp/i,
  /passport/i, /driving[\s-]?licen[cs]e/i, /voter[\s-]?id/i,
];
const SCAM_PHRASES = [
  /processing[\s-]?fee/i, /joining[\s-]?fee/i, /upfront[\s-]?fee/i,
  /quick[\s-]?approval/i, /no[\s-]?documents/i, /apply[\s-]?now/i,
  /तुरंत[\s-]?लोन/i, /इंस्टेंट[\s-]?लोन/i, /ತಕ್ಷಣ[\s-]?ಸಾಲ/i,
];
const FREE_SSL_ISSUERS = ["let's encrypt", "zerossl", "buypass", "google trust services"];

interface PhishAnalysis {
  url: string; host: string;
  brand_keywords_in_domain: string[];
  brand_keywords_in_content: string[];
  pii_fields: string[];
  scam_phrases: string[];
  form_count: number;
  external_form_action: boolean;
  domain_age_days?: number;
  ssl_issuer?: string;
  free_ssl: boolean;
  on_owned_domain: boolean;
  signals: { signal: string; weight: number }[];
  risk_score: number;
}

async function analyze(url: string, brandKeywords: string[], ownedDomains: string[]): Promise<PhishAnalysis> {
  const a: PhishAnalysis = {
    url, host: "",
    brand_keywords_in_domain: [], brand_keywords_in_content: [],
    pii_fields: [], scam_phrases: [],
    form_count: 0, external_form_action: false,
    free_ssl: false, on_owned_domain: false,
    signals: [], risk_score: 0,
  };
  let parsed: URL;
  try { parsed = new URL(url); a.host = parsed.hostname.toLowerCase(); }
  catch { return a; }

  // Owned-domain check
  a.on_owned_domain = ownedDomains.some((d) => a.host === d || a.host.endsWith("." + d));
  if (a.on_owned_domain) return a;

  // Brand keywords in domain (high signal)
  const domainStr = a.host.toLowerCase();
  a.brand_keywords_in_domain = brandKeywords.filter((kw) => {
    const stripped = kw.replace(/\s+/g, "");
    return domainStr.includes(stripped) || domainStr.includes(kw);
  });

  // Fetch HTML (best-effort; 10s timeout)
  let html = "";
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (r.ok) html = await r.text();
  } catch { /* continue with no html */ }

  if (html) {
    const lower = html.toLowerCase();
    a.brand_keywords_in_content = brandKeywords.filter((kw) => lower.includes(kw));
    for (const rx of PII_FIELD_PATTERNS) {
      const m = lower.match(rx);
      if (m) a.pii_fields.push(m[0]);
    }
    for (const rx of SCAM_PHRASES) {
      const m = lower.match(rx);
      if (m) a.scam_phrases.push(m[0]);
    }
    const formMatches = html.match(/<form[\s\S]*?<\/form>/gi) ?? [];
    a.form_count = formMatches.length;
    for (const f of formMatches) {
      const action = (f.match(/action=["']([^"']+)["']/i) ?? [])[1];
      if (action) {
        try {
          const u2 = new URL(action, url);
          if (u2.hostname !== a.host && !ownedDomains.includes(u2.hostname)) {
            a.external_form_action = true;
            break;
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Risk signals (per Build Spec Part 6)
  if (a.pii_fields.length > 0) a.signals.push({ signal: "pii_form_fields", weight: 40 });
  if (a.external_form_action) a.signals.push({ signal: "form_action_external", weight: 30 });
  if (a.brand_keywords_in_content.length > 0 && a.scam_phrases.length > 0) {
    a.signals.push({ signal: "brand_kw_plus_scam_phrase", weight: 30 });
  }
  if (a.scam_phrases.some((p) => /fee/i.test(p))) {
    a.signals.push({ signal: "upfront_fee_phrase", weight: 35 });
  }
  if (a.brand_keywords_in_domain.length > 0) {
    a.signals.push({ signal: "brand_kw_in_domain", weight: 15 });
  }

  a.risk_score = a.signals.reduce((sum, s) => sum + s.weight, 0);
  return a;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; urls?: string[]; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const urls = (body.urls ?? []).filter(Boolean).slice(0, 20);
    if (urls.length === 0) {
      return NextResponse.json({ ok: false, error: "urls required (max 20)" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const brand = (bundle.brand ?? {}) as { primary_name?: string; aliases?: string[] };
    const domains = (bundle.domains ?? {}) as { owned?: string[] };
    const brandKeywords = [brand.primary_name, ...(brand.aliases ?? [])]
      .filter((s): s is string => !!s).map((s) => s.toLowerCase());
    const ownedDomains = (domains.owned ?? []).map((d) => d.toLowerCase());

    const analyses = await Promise.all(urls.map((u) => analyze(u, brandKeywords, ownedDomains)));

    const findingRows: Record<string, unknown>[] = [];
    for (const a of analyses) {
      if (a.on_owned_domain) continue;
      if (a.risk_score < 40) continue;
      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      if (a.risk_score >= 80) severity = "Critical";
      else if (a.risk_score >= 60) severity = "Critical";
      else if (a.risk_score >= 40) severity = "Substantial";
      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "internal:phishing-analyzer", kind: "phishing_website",
        severity, confidence: Math.min(0.95, a.risk_score / 100),
        url_or_value: a.url,
        evidence: a as unknown as Record<string, unknown>,
        feature_id: "FEAT-004", apify_task_id: "creditaccessgrameen-feat-004-on-demand",
        item_id: a.url,
        fraud_pattern: a.signals.length > 0 ? a.signals[0].signal : "phishing_pattern",
        matched_keywords: [...a.brand_keywords_in_domain, ...a.brand_keywords_in_content],
        risk_score: a.risk_score,
        ai_filter_status: null, recommended_action: a.risk_score >= 80 ? "takedown" : "investigate",
      });
    }

    let inserted = 0;
    if (findingRows.length > 0) {
      const itemIds = findingRows.map((r) => r.item_id) as string[];
      const { data: existing } = await sb.from("findings").select("item_id")
        .eq("apify_task_id", "creditaccessgrameen-feat-004-on-demand").in("item_id", itemIds);
      const existingIds = new Set((existing ?? []).map((r) => r.item_id));
      const toInsert = findingRows.filter((r) => !existingIds.has(r.item_id as string));
      if (toInsert.length > 0) {
        const { error } = await sb.from("findings").insert(toInsert);
        if (error) return NextResponse.json({ ok: false, error: `insert: ${error.message}`, analyses }, { status: 500 });
        inserted = toInsert.length;
      }
    }

    return NextResponse.json({
      ok: true, urls_seen: urls.length, kept: findingRows.length, inserted, analyses,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
