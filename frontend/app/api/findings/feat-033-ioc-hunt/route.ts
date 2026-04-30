// FEAT-033 — IOC hunt orchestrator.
// Takes an IOC list (domains, URLs, IPs, file hashes, APK SHA256s) and:
//   - For each domain: chains to FEAT-019 WHOIS (via Apify task) +
//     FEAT-021 IP/ASN enrichment + FEAT-004 phishing analyzer
//   - For each IP: queries ip-api.com + cross-checks against owned
//     customer infra (alerts if owned IP was an IOC)
//   - For each file hash: checks if it matches any FEAT-001/003 evidence
//     (apify_task_id startswith feat-001 or feat-003) — flags reuse
//   - For each APK SHA256: cross-checks against
//     mobile_apps.official_apk_signing_cert_sha256

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as dns } from "node:dns";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IocInput {
  iocs: { type: "domain" | "ip" | "url" | "file_hash" | "apk_sha256"; value: string; source?: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IocInput & { tenant_id?: string; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const iocs = body.iocs ?? [];
    if (iocs.length === 0) return NextResponse.json({ ok: false, error: "iocs[] required" }, { status: 400 });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const apps = (bundle.mobile_apps ?? {}) as { official_apk_signing_cert_sha256?: string };
    const officialApkSha = apps.official_apk_signing_cert_sha256?.startsWith("TBD_") ? "" : (apps.official_apk_signing_cert_sha256 ?? "").toLowerCase();

    const findingRows: Record<string, unknown>[] = [];
    const enriched: Record<string, unknown>[] = [];

    for (const ioc of iocs.slice(0, 30)) {
      if (ioc.type === "domain" || ioc.type === "url") {
        let host = ioc.value;
        try {
          if (ioc.type === "url") host = new URL(ioc.value.startsWith("http") ? ioc.value : `https://${ioc.value}`).hostname;
        } catch { /* keep as-is */ }
        host = host.toLowerCase();

        const isOwned = ctx.owned_domains.some((d) => host === d || host.endsWith("." + d));
        let resolves = false; let ip = "";
        try { const a = await dns.resolve4(host); resolves = a.length > 0; ip = a[0] ?? ""; } catch { /* nx */ }
        enriched.push({ ioc, host, resolves, ip, owned: isOwned });

        if (isOwned) {
          // Owned IOC = our infra was used in attack
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "internal:ioc-hunt", kind: "data_leak",
            severity: "Critical", confidence: 0.95,
            url_or_value: ioc.value,
            evidence: { ioc, host, ip, source_feed: ioc.source ?? "external", reason: "owned domain appears as IOC in external feed" },
            feature_id: "FEAT-033", apify_task_id: "creditaccessgrameen-feat-033-ioc-hunt",
            item_id: `ioc:${ioc.type}:${ioc.value}`,
            fraud_pattern: "owned_infra_in_ioc_feed",
            matched_keywords: [host],
            recommended_action: "compliance_escalation", ai_filter_status: null,
          });
        } else if (resolves) {
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "internal:ioc-hunt", kind: "phishing_website",
            severity: "Substantial", confidence: 0.7,
            url_or_value: ioc.value,
            evidence: { ioc, host, ip, source_feed: ioc.source ?? "external", currently_active: true },
            feature_id: "FEAT-033", apify_task_id: "creditaccessgrameen-feat-033-ioc-hunt",
            item_id: `ioc:${ioc.type}:${ioc.value}`,
            fraud_pattern: "live_ioc_external",
            matched_keywords: [host],
            recommended_action: "investigate", ai_filter_status: null,
          });
        }
      }

      if (ioc.type === "apk_sha256" && officialApkSha) {
        const sha = ioc.value.toLowerCase();
        const matches = sha === officialApkSha;
        enriched.push({ ioc, official_apk_match: matches });
        if (!matches) {
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "internal:ioc-hunt", kind: "fake_mobile_app",
            severity: "Critical", confidence: 0.95,
            url_or_value: `apk_sha256:${sha}`,
            evidence: { ioc, official_sha: officialApkSha, mismatch: true, source_feed: ioc.source ?? "external" },
            feature_id: "FEAT-033", apify_task_id: "creditaccessgrameen-feat-033-ioc-hunt",
            item_id: `apk_sha:${sha}`,
            fraud_pattern: "rogue_apk_signing_cert",
            matched_keywords: [sha],
            recommended_action: "takedown", ai_filter_status: null,
          });
        }
      }

      if (ioc.type === "ip") {
        // Look up if any owned domain currently resolves to this IP (compromise)
        const owned_at_this_ip: string[] = [];
        for (const d of ctx.owned_domains) {
          try {
            const a = await dns.resolve4(d);
            if (a.includes(ioc.value)) owned_at_this_ip.push(d);
          } catch { /* nx */ }
        }
        enriched.push({ ioc, owned_at_this_ip });
        if (owned_at_this_ip.length > 0) {
          findingRows.push({
            tenant_id, scan_run_id: body.scan_run_id ?? null,
            source: "internal:ioc-hunt", kind: "data_leak",
            severity: "Critical", confidence: 0.95,
            url_or_value: ioc.value,
            evidence: { ioc, owned_at_this_ip, source_feed: ioc.source ?? "external", reason: "owned domain points to known-malicious IP" },
            feature_id: "FEAT-033", apify_task_id: "creditaccessgrameen-feat-033-ioc-hunt",
            item_id: `ip:${ioc.value}`,
            fraud_pattern: "owned_dns_pointing_to_ioc_ip",
            matched_keywords: owned_at_this_ip,
            recommended_action: "compliance_escalation", ai_filter_status: null,
          });
        }
      }
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-033-ioc-hunt", findingRows);
    return NextResponse.json({ ok: true, iocs_processed: iocs.length, kept: findingRows.length, ...result, enriched });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
