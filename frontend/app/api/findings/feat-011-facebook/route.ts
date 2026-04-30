// FEAT-011 — Facebook page + group monitoring.
// Apify actor TBD per customer plan (apify/facebook-pages-scraper is flat-
// price; on Starter use a custom apify/web-scraper task or wait for upgrade).
// This route is shape-agnostic: accepts any dataset row with a {url, title,
// content, author?} subset.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface FbItem {
  url?: string; pageUrl?: string; postUrl?: string;
  title?: string; pageName?: string; name?: string;
  content?: string; postText?: string; about?: string;
  author?: string; authorName?: string;
  pageId?: string; postId?: string;
  followersCount?: number; likesCount?: number; verified?: boolean;
}

const SCAM_PATTERNS = [
  /apply[\s-]?(?:for|now)/i, /processing[\s-]?fee/i, /joining[\s-]?fee/i,
  /quick[\s-]?(?:loan|approval)/i, /no[\s-]?documents/i,
  /तुरंत[\s-]?लोन/i,
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
    const officialFb = (social.facebook && !social.facebook.startsWith("TBD_")) ? social.facebook.toLowerCase() : "";

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as FbItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const f of items) {
      const text = `${f.title || f.pageName || f.name || ""} ${f.content || f.postText || f.about || ""}`.trim();
      const url = f.url || f.pageUrl || f.postUrl || "";
      if (officialFb && url.includes(`/${officialFb}/`)) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "fake_facebook_page";
      if (scamHits.length > 0) { severity = "Critical"; fraudPattern = "facebook_loan_scam"; }
      if (f.verified) { severity = "Moderate"; fraudPattern = "verified_brand_mention"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:facebook", kind: "fake_page",
        severity, confidence: 0.65,
        url_or_value: url,
        evidence: { text: text.slice(0, 400), author: f.author || f.authorName, pageId: f.pageId, postId: f.postId, followers: f.followersCount, likes: f.likesCount, verified: f.verified },
        feature_id: "FEAT-011", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: f.postId || f.pageId || url || `${body.apify_dataset_id}:${findingRows.length}`,
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
