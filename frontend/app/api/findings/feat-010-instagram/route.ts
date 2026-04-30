// FEAT-010 — Instagram brand monitoring.
// Consumes apify/instagram-profile-scraper dataset (PPDI).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IgItem {
  id?: string; pk?: string;
  username?: string; fullName?: string;
  biography?: string; bio?: string;
  followersCount?: number; followingCount?: number; verified?: boolean;
  url?: string; profilePicUrl?: string;
  postsCount?: number;
  hashtags?: string[];
}

const SCAM_PATTERNS = [
  /apply[\s-]?(?:for|now)/i, /quick[\s-]?(?:loan|approval)/i,
  /processing[\s-]?fee/i, /no[\s-]?documents/i,
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
    const officialIg = (social.instagram && !social.instagram.startsWith("TBD_")) ? social.instagram.toLowerCase() : "";

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as IgItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const ig of items) {
      const username = (ig.username || "").toLowerCase();
      if (officialIg && username === officialIg) { dropped += 1; continue; }
      const text = `${ig.fullName || ""} ${ig.biography || ig.bio || ""} ${(ig.hashtags ?? []).join(" ")}`;
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw) || username.includes(kw.replace(/\s+/g, "")));
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "instagram_brand_impersonation";
      if (scamHits.length > 0) { severity = "Critical"; fraudPattern = "instagram_loan_scam"; }
      if (ig.verified) { severity = "Moderate"; fraudPattern = "verified_brand_mention"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:instagram", kind: "fake_account",
        severity, confidence: 0.65,
        url_or_value: ig.url || `https://instagram.com/${username}`,
        evidence: { username, fullName: ig.fullName, bio: (ig.biography || ig.bio || "").slice(0, 300), followers: ig.followersCount, posts: ig.postsCount, verified: ig.verified },
        feature_id: "FEAT-010", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(ig.id || ig.pk || username || `${body.apify_dataset_id}:${findingRows.length}`),
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
