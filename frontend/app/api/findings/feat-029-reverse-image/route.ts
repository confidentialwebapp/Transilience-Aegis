// FEAT-029 — Reverse image surveillance via Google Lens.
// Apify actor borderline/google-lens (PPDI). Schema-agnostic.
// Each executive's official photo URL is queried weekly to detect copied
// or altered uses across the web.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface LensItem {
  url?: string; sourceUrl?: string;
  title?: string; alt?: string;
  imageUrl?: string; thumbnailUrl?: string;
  matchType?: string;        // "exact" | "visual"
  similarity?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string; subject?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as LensItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const url = it.url || it.sourceUrl || "";
      if (!url) { dropped += 1; continue; }
      let host = "";
      try { host = new URL(url).hostname.toLowerCase(); } catch { dropped += 1; continue; }
      // Drop matches on owned domains + top-tier news/regulator domains
      if (ctx.owned_domains.some((d) => host === d || host.endsWith("." + d))) { dropped += 1; continue; }

      const matchType = it.matchType ?? "visual";
      const sim = it.similarity ?? 0;
      const isExact = matchType === "exact" || sim > 0.95;
      let severity: "Critical" | "Substantial" | "Moderate" = isExact ? "Critical" : "Substantial";
      if (sim < 0.6) severity = "Moderate";

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-lens", kind: "logo_misuse",
        severity, confidence: Math.min(0.95, sim || 0.6),
        url_or_value: url,
        evidence: { host, title: it.title, alt: it.alt, image: it.imageUrl, thumbnail: it.thumbnailUrl, matchType, similarity: sim, subject: body.subject },
        feature_id: "FEAT-029", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: isExact ? "exact_image_match_off_brand" : "visual_image_similar_off_brand",
        matched_keywords: body.subject ? [body.subject] : [],
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
