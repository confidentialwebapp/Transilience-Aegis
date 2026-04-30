// FEAT-008 — News & regulatory watch.
// Reuses Google Search SERP results filtered to news-vertical domains.
// Surfaces RBI/SEBI advisories, sector-negative coverage, brand-specific
// negative news. Accepts the same dataset shape as FEAT-007.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SerpItem {
  url?: string; title?: string; description?: string;
  displayedUrl?: string;
}

const NEWS_HOSTS = [
  "rbi.org.in", "sebi.gov.in", "mfin.in", "sa-dhan.in",
  "bloombergquint.com", "moneycontrol.com", "livemint.com",
  "economictimes.com", "business-standard.com", "businessline.com",
  "reuters.com", "cert-in.org.in", "ibef.org",
];
const REGULATOR_PATTERNS = [
  /\b(advisory|caution|warn(ing|ed)|notice|directive|cease[\s-]?and[\s-]?desist)\b/i,
  /\b(banned|suspended|fine|penalty|enforcement)\b/i,
];
const NEGATIVE_PATTERNS = [
  /\b(scam|fraud|fake|cheat|alleged)\b/i, /\b(loss|crisis|default|delinquen)/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
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
      const isNews = NEWS_HOSTS.some((h) => host.endsWith(h));
      if (!isNews) { dropped += 1; continue; }

      const text = `${it.title ?? ""} ${it.description ?? ""}`;
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const isRegulator = host.endsWith("rbi.org.in") || host.endsWith("sebi.gov.in") || host.endsWith("cert-in.org.in") || host.endsWith("mfin.in");
      const regulatorHit = isRegulator && REGULATOR_PATTERNS.some((rx) => rx.test(text));
      const negative = NEGATIVE_PATTERNS.some((rx) => rx.test(text));

      let severity: "Critical" | "Substantial" | "Moderate" | "Low" = "Low";
      let fraudPattern = "news_brand_mention";
      if (regulatorHit) { severity = "Critical"; fraudPattern = "regulatory_advisory_brand"; }
      else if (negative) { severity = "Substantial"; fraudPattern = "negative_news_coverage"; }
      else { severity = "Moderate"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-search-news", kind: "negative_sentiment",
        severity, confidence: 0.7,
        url_or_value: url,
        evidence: { title: it.title, description: it.description, host, regulator: isRegulator },
        feature_id: "FEAT-008", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
        recommended_action: regulatorHit ? "compliance_escalation" : "monitor",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
