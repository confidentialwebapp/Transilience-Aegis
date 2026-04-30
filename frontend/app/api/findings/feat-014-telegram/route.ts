// FEAT-014 — Telegram public channel monitoring.
// Apify actor 73codes/telegram-channel-scraper or similar. Schema-agnostic.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TgMessage {
  messageId?: string | number; id?: string | number;
  channelId?: string; channelName?: string; channelUsername?: string;
  text?: string; messageText?: string;
  date?: string; messageDate?: string;
  url?: string; messageLink?: string;
  views?: number; forwards?: number;
  hasMedia?: boolean;
}

const SCAM_PATTERNS = [
  /apply[\s-]?(?:for|now)/i, /processing[\s-]?fee/i,
  /quick[\s-]?(?:loan|approval)/i, /no[\s-]?documents/i,
  /तुरंत[\s-]?लोन/i, /इंस्टेंट[\s-]?लोन/i,
  /click[\s-]?(?:here|link)/i, /whatsapp[\s-]?(?:contact|number)/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as TgMessage[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const m of items) {
      const text = (m.text || m.messageText || "").trim();
      if (!text) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const scamHits = SCAM_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      let fraudPattern = "telegram_brand_mention";
      if (scamHits.length >= 2) { severity = "Critical"; fraudPattern = "telegram_loan_scam"; }
      else if (scamHits.length === 1) severity = "Substantial";

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:telegram", kind: "social_impersonation",
        severity, confidence: 0.65,
        url_or_value: m.url || m.messageLink || "",
        evidence: { text: text.slice(0, 400), channel: m.channelName || m.channelUsername, channelId: m.channelId, date: m.date || m.messageDate, views: m.views, forwards: m.forwards },
        feature_id: "FEAT-014", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(m.messageId || m.id || `${m.channelId}:${m.date || ""}`),
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
