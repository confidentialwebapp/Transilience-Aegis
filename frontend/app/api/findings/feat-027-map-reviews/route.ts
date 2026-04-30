// FEAT-027 — Google Maps branch review monitoring.
// Consumes compass/Google-Maps-Reviews-Scraper dataset.
// Surfaces fraud/recovery-harassment mentions in reviews of CA Grameen
// branches (separate from FEAT-026 fake-branch detection).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReviewItem {
  reviewId?: string; reviewText?: string; text?: string;
  stars?: number; rating?: number;
  reviewerName?: string; reviewerId?: string;
  publishedAtDate?: string; publishedAt?: string;
  placeName?: string; placeId?: string;
  reviewUrl?: string; url?: string;
}

const FRAUD_PATTERNS = [
  { rx: /\b(fraud|scam|fake|cheat)/i,         label: "fraud_keyword",       sev: "Critical" as const },
  { rx: /(harass|threaten|abuse)/i,           label: "harassment_keyword",  sev: "Critical" as const, recommended: "compliance_escalation" },
  { rx: /(धोखा|ठगी|छल)/i,                      label: "hi_fraud_keyword",    sev: "Critical" as const },
  { rx: /(ಮೋಸ|ಮೋಸಗಾರ)/i,                       label: "kn_fraud_keyword",    sev: "Critical" as const },
  { rx: /(மோசடி)/i,                            label: "ta_fraud_keyword",    sev: "Critical" as const },
  { rx: /(మోసం)/i,                             label: "te_fraud_keyword",    sev: "Critical" as const },
  { rx: /(unprofessional|rude|misbehav)/i,    label: "unprofessional",      sev: "Moderate" as const },
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as ReviewItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const r of items) {
      const text = (r.reviewText || r.text || "").trim();
      if (!text || text.length < 5) { dropped += 1; continue; }
      const stars = r.stars ?? r.rating;
      // Only flag low-star reviews (≤2) — high-star "fraud" mentions are usually irrelevant
      if (stars !== undefined && stars > 2) {
        // Still scan for harassment which can appear in any-star
        const harassmentHit = /(harass|threaten|धमकी|बदसलूकी)/i.test(text);
        if (!harassmentHit) { dropped += 1; continue; }
      }

      const hits = FRAUD_PATTERNS.filter((p) => p.rx.test(text));
      if (hits.length === 0) { dropped += 1; continue; }

      const top = hits.reduce((a, b) => ({ Critical: 4, Substantial: 3, Moderate: 2, Low: 1 } as Record<string, number>)[a.sev] >= ({ Critical: 4, Substantial: 3, Moderate: 2, Low: 1 } as Record<string, number>)[b.sev] ? a : b);

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-maps-reviews", kind: "negative_sentiment",
        severity: top.sev, confidence: 0.75,
        url_or_value: r.reviewUrl || r.url || "",
        evidence: { text: text.slice(0, 500), stars, place: r.placeName, placeId: r.placeId, reviewer: r.reviewerName, date: r.publishedAtDate || r.publishedAt, hits: hits.map((h) => h.label) },
        feature_id: "FEAT-027", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: r.reviewId || `${r.placeId}:${(r.reviewerId || "")}:${(r.publishedAtDate || "")}`,
        fraud_pattern: top.label,
        matched_keywords: hits.map((h) => h.label),
        ai_filter_status: null,
        recommended_action: "recommended" in top ? top.recommended : "monitor",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
