// FEAT-017 — Paste-site monitoring (Pastebin / Gist / Pasteorg / Ideone /
// Dumpz / Textbin). Apify actor epctex/osint-scraper. Schema-agnostic.
//
// Per Build Spec Part 6 — borrower-PII match → MANDATORY regulatory
// disclosure → compliance escalation.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PasteItem {
  url?: string; pasteUrl?: string;
  title?: string; pasteTitle?: string;
  content?: string; pasteContent?: string; text?: string;
  source?: string; site?: string;
  date?: string; createdAt?: string;
  pasteId?: string; id?: string;
}

const PII_PATTERNS = [
  { rx: /\b\d{12}\b/, label: "12_digit_number_aadhaar_candidate" },
  { rx: /\b[A-Z]{5}\d{4}[A-Z]\b/, label: "pan_format" },
  { rx: /\b(borrower|customer)[\s-]?(?:list|id|database)/i, label: "customer_database_keyword" },
  { rx: /^\s*[\w\.-]+@[\w\.-]+\.[a-z]{2,}\s*[:|;]\s*\S+/im, label: "email_password_pair" },
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
    const leak = (bundle.leak_patterns ?? {}) as { email_patterns?: string[] };
    const emailDomains = (leak.email_patterns ?? []).map((p) => p.replace(/^\*@/, "").toLowerCase()).filter((d) => d && !d.startsWith("TBD_"));

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as PasteItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const p of items) {
      const content = p.content || p.pasteContent || p.text || "";
      if (!content) { dropped += 1; continue; }
      const matched = ctx.brand_keywords.filter((kw) => content.toLowerCase().includes(kw));
      const emailLeak = emailDomains.some((d) => content.toLowerCase().includes(`@${d}`));
      if (matched.length === 0 && !emailLeak) { dropped += 1; continue; }

      const piiHits = PII_PATTERNS.filter((pp) => pp.rx.test(content));
      const isCritical = emailLeak || piiHits.length >= 2;
      const severity: "Critical" | "Substantial" = isCritical ? "Critical" : "Substantial";
      const fraudPattern = emailLeak ? "paste_employee_email_leak"
        : piiHits.length > 0 ? "paste_pii_leak" : "paste_brand_mention";

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:paste-osint", kind: "data_leak",
        severity, confidence: 0.85,
        url_or_value: p.url || p.pasteUrl || "",
        evidence: { title: p.title || p.pasteTitle, content_preview: content.slice(0, 600), site: p.source || p.site, date: p.date || p.createdAt, pii_hits: piiHits.map((h) => h.label), email_leak: emailLeak },
        feature_id: "FEAT-017", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: String(p.pasteId || p.id || p.url || p.pasteUrl || `${body.apify_dataset_id}:${findingRows.length}`),
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
        recommended_action: isCritical ? "compliance_escalation" : "investigate",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
