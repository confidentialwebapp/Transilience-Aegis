// FEAT-023 — Investor Relations page integrity (NSE/SEBI compliance).
// Subset of FEAT-022 logic but specifically targets the IR pages with
// the highest compliance escalation severity. Per Build Spec Part 6:
// any IR change outside maintenance window → Compliance escalation.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const IR_PATHS = [
  "/investor-relations", "/investors", "/investor", "/ir", "/investor/announcements",
  "/disclosures", "/financials", "/annual-reports",
];

interface IrCheck {
  url: string;
  status?: number;
  hash?: string;
  baseline_hash?: string;
  drift?: boolean;
  fetch_error?: string;
}

async function check(url: string, baseline?: string): Promise<IrCheck> {
  const out: IrCheck = { url };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow" });
    out.status = r.status;
    if (!r.ok) { out.fetch_error = `HTTP ${r.status}`; return out; }
    const html = await r.text();
    const stripped = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
    out.hash = createHash("sha256").update(stripped).digest("hex");
    out.baseline_hash = baseline;
    out.drift = baseline !== undefined && baseline !== "" && out.hash !== baseline;
  } catch (e) {
    out.fetch_error = (e as Error).message;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      baselines?: Record<string, string>;
      scan_run_id?: string;
    };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);

    const urls: string[] = [];
    for (const d of ctx.owned_domains) {
      for (const p of IR_PATHS) urls.push(`https://${d}${p}`);
    }
    const checks = await Promise.all(urls.map((u) => check(u, body.baselines?.[u])));

    const findingRows: Record<string, unknown>[] = [];
    for (const c of checks) {
      if (c.status === 200 && c.drift) {
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "internal:ir-integrity", kind: "fake_login_page",
          severity: "Critical", confidence: 0.95,
          url_or_value: c.url,
          evidence: c as unknown as Record<string, unknown>,
          feature_id: "FEAT-023", apify_task_id: "creditaccessgrameen-feat-023-ir",
          item_id: `${c.url}:drift`,
          fraud_pattern: "ir_page_dom_drift",
          recommended_action: "compliance_escalation",
          matched_keywords: ["NSE", "SEBI"],
        });
      }
    }
    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-023-ir", findingRows);
    return NextResponse.json({ ok: true, checks_run: checks.length, kept: findingRows.length, ...result, sample: checks.filter(c => c.status === 200).slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
