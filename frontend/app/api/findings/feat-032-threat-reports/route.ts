// FEAT-032 — Brand mentions in public threat-intelligence reports.
// Consumes Google Search SERP dataset where queries target known
// threat-intel hosts (CERT-In, I4C, Group-IB, Mandiant, Cyfirma, Recorded
// Future, etc.) and the brand name. A mention in a public threat report
// signals an active campaign or breach attribution.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SerpItem {
  url?: string; title?: string; description?: string;
  displayedUrl?: string;
}

const TI_HOSTS = [
  "cert-in.org.in", "i4c.gov.in", "group-ib.com", "mandiant.com",
  "cyfirma.com", "recordedfuture.com", "intel471.com", "flashpoint.io",
  "kaspersky.com", "bitdefender.com", "trendmicro.com", "securelist.com",
  "krebsonsecurity.com", "thehackernews.com", "bleepingcomputer.com",
];

const ATTACK_PATTERNS = [
  /\b(victim|breached?|compromis|target(ed)?|exfiltrat)/i,
  /\b(ransomware|dropper|trojan|infostealer|stealer log)/i,
  /\b(C2|command[\s-]?and[\s-]?control|IOC|indicator)/i,
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
      const isTi = TI_HOSTS.some((h) => host.endsWith(h));
      if (!isTi) { dropped += 1; continue; }

      const text = `${it.title ?? ""} ${it.description ?? ""}`;
      const matched = ctx.brand_keywords.filter((kw) => text.toLowerCase().includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      const attackHits = ATTACK_PATTERNS.filter((rx) => rx.test(text));
      let severity: "Critical" | "Substantial" = "Substantial";
      let fraudPattern = "threat_intel_brand_mention";
      if (attackHits.length >= 2) { severity = "Critical"; fraudPattern = "threat_intel_attack_attribution"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-search-ti", kind: "data_leak",
        severity, confidence: 0.85,
        url_or_value: url,
        evidence: { title: it.title, description: it.description, host, attack_signals: attackHits.length },
        feature_id: "FEAT-032", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
        recommended_action: "compliance_escalation",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
