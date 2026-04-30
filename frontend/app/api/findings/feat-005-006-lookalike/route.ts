// FEAT-005 + FEAT-006 — Lookalike domain discovery + classification.
//
// Hybrid pipeline:
//   1. Kali dnstwist (--registered) on each owned domain
//   2. crt.sh fetch for new SSL certs containing brand keywords
//   3. Dedupe candidates against KV-store baseline
//   4. For each NEW candidate: classify via FEAT-004 phishing analyzer
//
// Phase 1 ships steps 1-3 here; classification chains into FEAT-004
// /api/findings/feat-004-classify for top-N candidates (cost-bounded).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const KALI_API_BASE = process.env.NEXT_PUBLIC_OSINT_API_BASE ?? "https://transilience--aegis-osint-api-web.modal.run";
const APP_URL = "https://tai-aegis.vercel.app";

interface DnstwistRow {
  domain: string; fuzzer: string;
  dns_a?: string[]; dns_ns?: string[]; dns_mx?: string[];
}

async function callDnstwist(domain: string): Promise<DnstwistRow[]> {
  try {
    const r = await fetch(`${KALI_API_BASE}/dnstwist?domain=${encodeURIComponent(domain)}`, {
      method: "GET", signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: DnstwistRow[] };
    return j.results ?? [];
  } catch { return []; }
}

async function callCrtSh(brandKeyword: string): Promise<string[]> {
  // crt.sh JSON output: array of {common_name, name_value, ...}
  try {
    const r = await fetch(`https://crt.sh/?q=%25${encodeURIComponent(brandKeyword)}%25&output=json`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return [];
    const items = (await r.json()) as { common_name?: string; name_value?: string }[];
    const domains = new Set<string>();
    for (const it of items) {
      if (it.common_name) domains.add(it.common_name.toLowerCase());
      for (const n of (it.name_value ?? "").split("\n")) {
        const d = n.trim().toLowerCase();
        if (d && !d.startsWith("*")) domains.add(d);
      }
    }
    return [...domains];
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; classify_top_n?: number; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const classifyTopN = Math.min(body.classify_top_n ?? 10, 20);

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const domains = (bundle.domains ?? {}) as { owned?: string[]; watch_keywords?: string[] };
    const ownedDomains = (domains.owned ?? []);
    const watchKeywords = (domains.watch_keywords ?? []).slice(0, 4);   // top-4 keywords for crt.sh

    if (ownedDomains.length === 0) {
      return NextResponse.json({ ok: false, error: "no owned domains in customer_assets" }, { status: 400 });
    }

    // 1. dnstwist for each owned domain
    const dnstwistResults = await Promise.allSettled(ownedDomains.map(callDnstwist));
    const dnstwistRegistered: { domain: string; fuzzer: string; src: string }[] = [];
    for (let i = 0; i < dnstwistResults.length; i++) {
      const res = dnstwistResults[i];
      if (res.status !== "fulfilled") continue;
      for (const r of res.value) {
        if (r.fuzzer === "*original") continue;
        if (Array.isArray(r.dns_a) && r.dns_a.length > 0) {
          dnstwistRegistered.push({ domain: r.domain, fuzzer: r.fuzzer, src: `dnstwist:${ownedDomains[i]}` });
        }
      }
    }

    // 2. crt.sh for top-4 watch_keywords
    const crtshResults = await Promise.allSettled(watchKeywords.map(callCrtSh));
    const crtshDomains: { domain: string; src: string }[] = [];
    for (let i = 0; i < crtshResults.length; i++) {
      const res = crtshResults[i];
      if (res.status !== "fulfilled") continue;
      for (const d of res.value) {
        if (ownedDomains.includes(d)) continue;
        crtshDomains.push({ domain: d, src: `crtsh:${watchKeywords[i]}` });
      }
    }

    // 3. Dedupe + tag everything as a candidate
    const seen = new Set<string>();
    const candidates: { domain: string; sources: string[]; fuzzer?: string }[] = [];
    for (const r of dnstwistRegistered) {
      if (seen.has(r.domain)) continue;
      seen.add(r.domain);
      candidates.push({ domain: r.domain, sources: [r.src], fuzzer: r.fuzzer });
    }
    for (const r of crtshDomains) {
      if (seen.has(r.domain)) {
        const c = candidates.find((c) => c.domain === r.domain);
        if (c) c.sources.push(r.src);
        continue;
      }
      seen.add(r.domain);
      candidates.push({ domain: r.domain, sources: [r.src] });
    }

    // 4. Insert candidates as Low-severity "lookalike_domain" findings
    const findingRows: Record<string, unknown>[] = [];
    for (const c of candidates) {
      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "internal:lookalike-discovery", kind: "lookalike_domain",
        severity: "Moderate", confidence: 0.5,
        url_or_value: c.domain,
        evidence: { domain: c.domain, sources: c.sources, fuzzer: c.fuzzer },
        feature_id: "FEAT-005", apify_task_id: "creditaccessgrameen-feat-005-lookalike",
        item_id: c.domain, language_detected: "en",
        fraud_pattern: c.fuzzer ? `dnstwist_${c.fuzzer}` : "crtsh_brand_match",
        matched_keywords: c.sources,
        ai_filter_status: null, recommended_action: "investigate",
      });
    }
    let inserted = 0;
    if (findingRows.length > 0) {
      const itemIds = findingRows.map((r) => r.item_id) as string[];
      const { data: existing } = await sb.from("findings").select("item_id")
        .eq("apify_task_id", "creditaccessgrameen-feat-005-lookalike").in("item_id", itemIds);
      const existingIds = new Set((existing ?? []).map((r) => r.item_id));
      const toInsert = findingRows.filter((r) => !existingIds.has(r.item_id as string));
      if (toInsert.length > 0) {
        const { error } = await sb.from("findings").insert(toInsert);
        if (!error) inserted = toInsert.length;
      }
    }

    // 5. Chain top-N into FEAT-004 phishing analyzer for risk classification
    let classified = 0;
    let phishingFlagged = 0;
    if (candidates.length > 0 && classifyTopN > 0) {
      const candidateUrls = candidates.slice(0, classifyTopN).map((c) => `https://${c.domain}/`);
      try {
        const cr = await fetch(`${APP_URL}/api/findings/feat-004-classify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id, urls: candidateUrls, scan_run_id: body.scan_run_id }),
          signal: AbortSignal.timeout(50000),
        });
        if (cr.ok) {
          const cj = (await cr.json()) as { kept?: number; analyses?: unknown[] };
          classified = cj.analyses?.length ?? 0;
          phishingFlagged = cj.kept ?? 0;
        }
      } catch { /* downstream call best-effort */ }
    }

    return NextResponse.json({
      ok: true,
      owned_domains: ownedDomains, watch_keywords_used: watchKeywords,
      dnstwist_registered: dnstwistRegistered.length,
      crtsh_brand_match: crtshDomains.length,
      total_candidates: candidates.length, inserted,
      phishing_classified: classified, phishing_flagged: phishingFlagged,
      sample: candidates.slice(0, 8),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
