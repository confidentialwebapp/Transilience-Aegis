// FEAT-009 — Twitter/X brand monitoring.
// Consumes apidojo/tweet-scraper dataset (PPDI ~$0.40/1k tweets).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Tweet {
  id?: string; tweetId?: string;
  text?: string; full_text?: string;
  url?: string; tweetUrl?: string;
  user?: { username?: string; name?: string; verified?: boolean; followersCount?: number };
  author?: { userName?: string; name?: string; isVerified?: boolean };
  createdAt?: string; date?: string;
  likeCount?: number; retweetCount?: number; replyCount?: number;
  hashtags?: string[];
}

const SCAM_PATTERNS = [
  /apply[\s-]?(?:for|now)/i, /quick[\s-]?(?:loan|approval)/i,
  /no[\s-]?documents/i, /processing[\s-]?fee/i,
  /तुरंत[\s-]?लोन/i, /इंस्टेंट/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);

    // Pull verified handles from social_handles
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const social = (bundle.social_handles ?? {}) as Record<string, string>;
    const officialTwitter = (social.twitter && !social.twitter.startsWith("TBD_")) ? social.twitter.toLowerCase() : "";

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as Tweet[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const t of items) {
      const text = (t.text || t.full_text || "").trim();
      const username = (t.user?.username || t.author?.userName || "").toLowerCase();
      const url = t.tweetUrl || t.url || "";
      if (!text) { dropped += 1; continue; }
      if (officialTwitter && username === officialTwitter) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      let fraudPattern = "social_brand_mention";
      if (scamHits.length >= 2) { severity = "Critical"; fraudPattern = "twitter_loan_scam"; }
      else if (scamHits.length === 1) severity = "Substantial";

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:tweet", kind: "social_impersonation",
        severity, confidence: 0.65,
        url_or_value: url,
        evidence: { text: text.slice(0, 300), username, name: t.user?.name || t.author?.name, verified: t.user?.verified || t.author?.isVerified, followers: t.user?.followersCount, engagement: { likes: t.likeCount, rt: t.retweetCount, replies: t.replyCount } },
        feature_id: "FEAT-009", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: t.tweetId || t.id || url || `${body.apify_dataset_id}:${findingRows.length}`,
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
