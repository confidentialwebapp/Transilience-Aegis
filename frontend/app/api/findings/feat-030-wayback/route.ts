// FEAT-030 — Wayback historical asset discovery.
// Uses web.archive.org's CDX server API (free) to enumerate historical
// subdomains + paths for owned domains. Surfaces orphan subdomains that
// resolved in the past — subdomain takeover candidates.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as dns } from "node:dns";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function cdxLookup(domain: string): Promise<{ url: string; timestamp: string }[]> {
  const url = `https://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&limit=200&fl=timestamp,original&from=20180101`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return [];
    const arr = (await r.json()) as string[][];
    return arr.slice(1).map(([timestamp, original]) => ({ timestamp, url: original }));
  } catch { return []; }
}

async function isResolvable(host: string): Promise<boolean> {
  try { await dns.resolve4(host); return true; }
  catch {
    try { await dns.resolveCname(host); return true; }
    catch { return false; }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);

    const findingRows: Record<string, unknown>[] = [];
    let totalEntries = 0;
    const subdomainsFound = new Set<string>();

    for (const ownedDomain of ctx.owned_domains.slice(0, 3)) {
      const entries = await cdxLookup(ownedDomain);
      totalEntries += entries.length;
      for (const e of entries) {
        try {
          const u = new URL(e.url);
          const host = u.hostname.toLowerCase();
          if (!host.endsWith("." + ownedDomain) && host !== ownedDomain) continue;
          if (host === ownedDomain) continue;
          subdomainsFound.add(host);
        } catch { /* ignore parse */ }
      }
    }

    // For each historical subdomain found, check if it's still resolvable.
    // Resolvable historical subdomains we don't know about are suspect.
    const samples = [...subdomainsFound].slice(0, 30);
    for (const sub of samples) {
      const resolves = await isResolvable(sub);
      if (!resolves) continue;     // gone — no risk
      // Check if it's already in aegis_assets
      const { data: existing } = await sb.from("aegis_assets")
        .select("id").eq("tenant_id", tenant_id).eq("type", "subdomain").eq("value", sub).maybeSingle();
      if (existing) continue;     // tracked

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "internal:wayback", kind: "domain_typosquat",
        severity: "Substantial", confidence: 0.6,
        url_or_value: sub,
        evidence: { historical_subdomain: sub, currently_resolvable: true },
        feature_id: "FEAT-030", apify_task_id: "creditaccessgrameen-feat-030-wayback",
        item_id: sub,
        fraud_pattern: "wayback_unknown_subdomain",
        matched_keywords: [],
        ai_filter_status: null,
        recommended_action: "investigate",
      });
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-030-wayback", findingRows);
    return NextResponse.json({
      ok: true, owned_domains_scanned: ctx.owned_domains.length,
      historical_entries: totalEntries, unique_subdomains: subdomainsFound.size,
      sampled: samples.length, kept: findingRows.length, ...result,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
