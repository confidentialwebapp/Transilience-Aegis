// FEAT-012 — YouTube brand monitoring.
// Consumes streamers/youtube-scraper dataset.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface YtItem {
  url?: string; videoUrl?: string;
  title?: string; description?: string;
  channelName?: string; channelUrl?: string; channelHandle?: string;
  videoId?: string; id?: string;
  views?: number; viewCount?: number;
  publishedAt?: string; date?: string;
  thumbnail?: string;
}

const SCAM_PATTERNS = [
  /apply[\s-]?(?:for|now)/i, /quick[\s-]?(?:loan|approval)/i,
  /processing[\s-]?fee/i, /tutorial[\s-]?(?:loan|apply)/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const social = (bundle.social_handles ?? {}) as Record<string, string>;
    const officialYt = (social.youtube && !social.youtube.startsWith("TBD_")) ? social.youtube.toLowerCase() : "";

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as YtItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const v of items) {
      const channel = (v.channelHandle || v.channelName || "").toLowerCase();
      if (officialYt && channel.includes(officialYt)) { dropped += 1; continue; }

      const text = `${v.title || ""} ${v.description || ""}`;
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      let fraudPattern = "youtube_brand_mention";
      if (scamHits.length > 0) { severity = "Critical"; fraudPattern = "youtube_loan_tutorial_scam"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:youtube", kind: "social_impersonation",
        severity, confidence: 0.65,
        url_or_value: v.url || v.videoUrl || `https://youtube.com/watch?v=${v.videoId || v.id}`,
        evidence: { title: v.title, description: (v.description || "").slice(0, 400), channel: v.channelName, channelUrl: v.channelUrl, views: v.views || v.viewCount, published: v.publishedAt || v.date },
        feature_id: "FEAT-012", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(v.videoId || v.id || v.url || `${body.apify_dataset_id}:${findingRows.length}`),
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
