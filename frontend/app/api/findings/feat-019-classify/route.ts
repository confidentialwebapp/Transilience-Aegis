// FEAT-019 — WHOIS/DNS/SSL bulk classifier.
// Consumes sovereigntaylor/domain-whois-scraper dataset.
// Surfaces high-risk signals on candidate domains:
//   - Domain age < 30 days + brand kw → CRITICAL phishing candidate
//   - SSL cert from free issuer (Let's Encrypt etc.) + brand kw in domain → SUBSTANTIAL
//   - WHOIS hidden / privacy-protected + brand kw → SUBSTANTIAL
//   - SSL expired or not present + ours → CRITICAL (own-cert misconfiguration)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx, isOwnedDomain } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface WhoisItem {
  domain?: string;
  whois?: { creation_date?: string; registrar?: string; privacy_protected?: boolean };
  dns?: { a?: string[]; mx?: string[]; ns?: string[] };
  ssl?: { issuer?: string; valid_to?: string; valid?: boolean };
  tech_stack?: string[];
}

const FREE_SSL = ["let's encrypt", "zerossl", "buypass", "google trust services"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as WhoisItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const domain = (it.domain ?? "").toLowerCase();
      if (!domain) { dropped += 1; continue; }
      const isOwned = isOwnedDomain(domain, ctx.owned_domains);
      const brandKwInDomain = ctx.brand_keywords.some((kw) => domain.includes(kw.replace(/\s+/g, "")));
      const watchKwInDomain = ctx.watch_keywords.some((kw) => domain.includes(kw));
      const hasBrandSignal = brandKwInDomain || watchKwInDomain;

      const created = it.whois?.creation_date ? new Date(it.whois.creation_date) : null;
      const ageDays = created ? (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
      const issuer = (it.ssl?.issuer ?? "").toLowerCase();
      const freeSsl = FREE_SSL.some((p) => issuer.includes(p));

      // Owned-domain checks: misconfiguration alerts
      if (isOwned) {
        if (it.ssl?.valid === false) {
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "apify:whois", kind: "fake_login_page", severity: "Critical", confidence: 0.95,
            url_or_value: domain,
            evidence: { reason: "owned domain SSL invalid", whois: it.whois, ssl: it.ssl },
            feature_id: "FEAT-019", apify_task_id: body.task_id, item_id: domain,
            fraud_pattern: "owned_domain_ssl_misconfigured",
            recommended_action: "investigate", matched_keywords: [],
          });
        }
        continue;
      }

      // Non-owned domain — only score if there's a brand signal in the domain
      if (!hasBrandSignal) { dropped += 1; continue; }

      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      const signals: string[] = [];
      if (ageDays < 30) { severity = "Critical"; signals.push("recent_registration"); }
      if (freeSsl) { signals.push("free_ssl_issuer"); if (severity !== "Critical") severity = "Substantial"; }
      if (it.whois?.privacy_protected) { signals.push("whois_hidden"); if (severity === "Moderate") severity = "Substantial"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:whois", kind: "domain_typosquat",
        severity, confidence: 0.65,
        url_or_value: domain,
        evidence: { whois: it.whois, dns: it.dns, ssl: it.ssl, tech_stack: it.tech_stack, signals },
        feature_id: "FEAT-019", apify_task_id: body.task_id, item_id: domain,
        fraud_pattern: signals[0] ?? "lookalike_whois",
        matched_keywords: ctx.brand_keywords.filter((kw) => domain.includes(kw.replace(/\s+/g, ""))),
        recommended_action: "investigate",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
