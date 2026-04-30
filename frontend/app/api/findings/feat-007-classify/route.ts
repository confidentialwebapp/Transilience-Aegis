// FEAT-007 — Brand SERP classifier.
// Consumes apify/google-search-scraper dataset; SERP rows have fields
// title, url, description, domain. Classifies each result against
// owned-domains allowlist + brand-keyword presence + scam-phrase signals.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx, isOwnedDomain, brandMatches } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SerpItem {
  title?: string; url?: string; displayedUrl?: string;
  description?: string; emphasizedKeywords?: string[];
  position?: number; siteLinks?: unknown[];
}

const SCAM_PATTERNS = [
  /instant[\s-]?loan/i, /quick[\s-]?approval/i, /no[\s-]?documents/i,
  /apply[\s-]?now/i, /processing[\s-]?fee/i, /तुरंत[\s-]?लोन/i,
  /इंस्टेंट[\s-]?लोन/i, /ತಕ್ಷಣ[\s-]?ಸಾಲ/i, /ಗ್ರಾಮೀಣ[\s-]?ಸಾಲ/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string; language?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as SerpItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const url = it.url || it.displayedUrl || "";
      let host = "";
      try { host = new URL(url).hostname.toLowerCase(); } catch { dropped += 1; continue; }
      if (isOwnedDomain(host, ctx.owned_domains)) { dropped += 1; continue; }

      const text = `${it.title ?? ""} ${it.description ?? ""}`;
      const matched = brandMatches(text, ctx.brand_keywords);
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      let fraudPattern = "brand_serp_third_party";
      if (scamHits.length >= 2) { severity = "Critical"; fraudPattern = "loan_scam_serp"; }
      else if (scamHits.length === 1) severity = "Substantial";

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-search", kind: "phishing",
        severity, confidence: 0.6,
        url_or_value: url,
        evidence: { title: it.title, description: it.description, host, position: it.position, scam_signals: scamHits.length },
        feature_id: "FEAT-007", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url || `${body.apify_dataset_id}:${findingRows.length}`,
        language_detected: body.language ?? "en",
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null, recommended_action: severity === "Critical" ? "investigate" : "monitor",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
