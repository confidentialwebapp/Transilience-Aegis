// FEAT-013 — Reddit brand monitoring.
// Consumes trudax/reddit-scraper-lite dataset (PPDI cheap).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RedditItem {
  id?: string; postId?: string;
  title?: string; body?: string; selftext?: string;
  url?: string; permalink?: string;
  subreddit?: string;
  author?: string;
  score?: number; numComments?: number;
  createdAt?: string; createdUtc?: number;
}

const COMPLAINT_PATTERNS = [
  /(scam|fraud|fake|cheat|misled|misleading|harass|threat)/i,
  /(loan[\s-]?recovery|recovery[\s-]?agent)/i,
  /(धोखा|शिकायत|बदसलूकी)/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as RedditItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const r of items) {
      const text = `${r.title || ""} ${r.body || r.selftext || ""}`.trim();
      if (!text) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const complaintHits = COMPLAINT_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" | "Low" = "Low";
      let fraudPattern = "reddit_brand_mention";
      if (complaintHits.length >= 2) { severity = "Critical"; fraudPattern = "reddit_complaint_pattern"; }
      else if (complaintHits.length === 1) { severity = "Substantial"; fraudPattern = "reddit_negative_mention"; }
      else { severity = "Moderate"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:reddit", kind: "negative_sentiment",
        severity, confidence: 0.6,
        url_or_value: r.url || (r.permalink ? `https://reddit.com${r.permalink}` : ""),
        evidence: { title: r.title, body: (r.body || r.selftext || "").slice(0, 500), subreddit: r.subreddit, author: r.author, score: r.score, comments: r.numComments },
        feature_id: "FEAT-013", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(r.postId || r.id || r.url || r.permalink || `${body.apify_dataset_id}:${findingRows.length}`),
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
        recommended_action: severity === "Critical" ? "investigate" : "monitor",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
