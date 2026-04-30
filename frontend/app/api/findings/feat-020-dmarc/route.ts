// FEAT-020 — DMARC / SPF / DKIM configuration check.
// On-demand DNS lookup against owned domains via Modal Kali endpoint.
// No paid Apify actor needed — pure DNS.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";
import { promises as dns } from "node:dns";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DmarcReport {
  domain: string;
  spf?: { record?: string | null; policy?: "soft" | "hard" | "none" | "unknown" };
  dmarc?: { record?: string | null; policy?: "none" | "quarantine" | "reject" | "unknown"; pct?: number };
  dkim_present?: boolean;
}

async function checkDomain(domain: string): Promise<DmarcReport> {
  const out: DmarcReport = { domain };
  // SPF
  try {
    const txt = await dns.resolveTxt(domain);
    const flat = txt.flat().join(" ");
    const spf = flat.match(/v=spf1\b[^"]*/i);
    if (spf) {
      const record = spf[0];
      let policy: "soft" | "hard" | "none" | "unknown" = "unknown";
      if (/-all\b/i.test(record)) policy = "hard";
      else if (/~all\b/i.test(record)) policy = "soft";
      else if (/\?all\b|\+all\b/i.test(record)) policy = "none";
      out.spf = { record, policy };
    } else { out.spf = { record: null, policy: "none" }; }
  } catch { out.spf = { record: null, policy: "none" }; }

  // DMARC
  try {
    const txt = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = txt.flat().join(" ");
    const m = flat.match(/v=DMARC1\b[^"]*/i);
    if (m) {
      const record = m[0];
      const policyMatch = record.match(/p=(none|quarantine|reject)/i);
      const pctMatch = record.match(/pct=(\d+)/i);
      out.dmarc = {
        record,
        policy: (policyMatch?.[1].toLowerCase() ?? "unknown") as DmarcReport["dmarc"] extends infer T ? T extends { policy: infer P } ? P : never : never,
        pct: pctMatch ? parseInt(pctMatch[1], 10) : 100,
      };
    } else { out.dmarc = { record: null, policy: "none" }; }
  } catch { out.dmarc = { record: null, policy: "none" }; }

  // DKIM presence is best-effort (selectors are private). Try common selectors.
  out.dkim_present = false;
  for (const selector of ["default", "google", "selector1", "selector2", "k1"]) {
    try {
      const txt = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
      if (txt.flat().some((s) => /v=DKIM1/i.test(s))) {
        out.dkim_present = true;
        break;
      }
    } catch { /* not present at that selector */ }
  }

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    if (ctx.owned_domains.length === 0) {
      return NextResponse.json({ ok: false, error: "no owned domains" }, { status: 400 });
    }

    const reports = await Promise.all(ctx.owned_domains.map(checkDomain));

    const findingRows: Record<string, unknown>[] = [];
    for (const r of reports) {
      const dmarcPolicy = r.dmarc?.policy ?? "none";
      const spfPolicy = r.spf?.policy ?? "none";

      // Per Build Spec Part 6 — BFSI minimum is DMARC p=reject
      if (dmarcPolicy !== "reject") {
        const severity = dmarcPolicy === "none" ? "Critical" : "Substantial";
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:dmarc-check", kind: "fake_login_page",
          severity, confidence: 0.95,
          url_or_value: r.domain,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-020", apify_task_id: "creditaccessgrameen-feat-020-dmarc",
          item_id: `${r.domain}:dmarc`,
          fraud_pattern: `dmarc_policy_${dmarcPolicy}`,
          recommended_action: "harden",
          matched_keywords: [],
        });
      }
      if (spfPolicy === "soft" || spfPolicy === "none") {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:dmarc-check", kind: "fake_login_page",
          severity: spfPolicy === "none" ? "Critical" : "Moderate", confidence: 0.9,
          url_or_value: r.domain,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-020", apify_task_id: "creditaccessgrameen-feat-020-dmarc",
          item_id: `${r.domain}:spf`,
          fraud_pattern: `spf_policy_${spfPolicy}`,
          recommended_action: "harden",
          matched_keywords: [],
        });
      }
      if (!r.dkim_present) {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:dmarc-check", kind: "fake_login_page",
          severity: "Moderate", confidence: 0.7,
          url_or_value: r.domain,
          evidence: r as unknown as Record<string, unknown>,
          feature_id: "FEAT-020", apify_task_id: "creditaccessgrameen-feat-020-dmarc",
          item_id: `${r.domain}:dkim`,
          fraud_pattern: "dkim_selector_not_found",
          recommended_action: "review",
          matched_keywords: [],
        });
      }
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-020-dmarc", findingRows);
    return NextResponse.json({ ok: true, reports, kept: findingRows.length, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
