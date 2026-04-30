// FEAT-016 — Dark web keyword sweep.
// Apify actor crawlerbros/darkweb-scraper. Schema-agnostic.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DarkItem {
  url?: string; onionUrl?: string;
  title?: string; pageTitle?: string;
  text?: string; content?: string;
  matchedKeyword?: string; keyword?: string;
  forumName?: string; threadId?: string; postId?: string;
  date?: string;
}

const RANSOM_PATTERNS = [
  /(ransom(ware)?|leak[\s-]?site|extortion)/i,
  /(decrypt(or|ion)?[\s-]?key)/i,
  /\b(lockbit|conti|alphv|blackcat|hive|akira|royal|play|medusa)\b/i,
];
const PII_PATTERNS = [
  /\baadhaar?\b|\bpan[\s-]?card\b|\bborrower[\s-]?(?:list|database)\b/i,
  /\bcustomer[\s-]?(?:data|database|list)\b/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as DarkItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const text = `${it.title || it.pageTitle || ""} ${it.text || it.content || ""}`.trim();
      if (!text) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const ransomHit = RANSOM_PATTERNS.some((rx) => rx.test(text));
      const piiHit = PII_PATTERNS.some((rx) => rx.test(text));

      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "darkweb_brand_mention";
      let recommended = "investigate";
      if (ransomHit) { severity = "Critical"; fraudPattern = "ransomware_leak_site"; recommended = "compliance_escalation"; }
      else if (piiHit) { severity = "Critical"; fraudPattern = "darkweb_pii_leak"; recommended = "compliance_escalation"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:darkweb", kind: "data_leak",
        severity, confidence: 0.75,
        url_or_value: it.url || it.onionUrl || "",
        evidence: { title: it.title || it.pageTitle, text: text.slice(0, 500), forum: it.forumName, date: it.date, ransom: ransomHit, pii: piiHit },
        feature_id: "FEAT-016", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(it.postId || it.threadId || it.url || it.onionUrl || `${body.apify_dataset_id}:${findingRows.length}`),
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
        recommended_action: recommended,
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
