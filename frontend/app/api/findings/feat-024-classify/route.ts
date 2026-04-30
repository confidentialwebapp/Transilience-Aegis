// FEAT-024 — Naukri / LinkedIn / Indeed recruitment scam detection.
// Consumes agentx/all-jobs-scraper dataset.
//
// Per Build Spec Part 6 detection rules:
//   - Job posted as CA Grameen / Grameen Koota but recruiter ∉ verified
//     HR roster → CRITICAL recruitment_fraud
//   - Job asks for processing fee / training fee → CRITICAL
//   - Application form asks for PAN/Aadhaar upfront → CRITICAL

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx, isOwnedDomain } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JobItem {
  jobTitle?: string; title?: string;
  company?: string; companyName?: string; employer?: string;
  location?: string; description?: string; jobDescription?: string;
  jobUrl?: string; url?: string;
  recruiterName?: string; recruiterEmail?: string;
  postedDate?: string; jobId?: string;
  source?: string;        // "naukri" | "linkedin" | "indeed" | etc.
}

const FEE_PATTERNS = [
  /processing[\s-]?fee/i, /registration[\s-]?fee/i, /joining[\s-]?fee/i,
  /training[\s-]?fee/i, /security[\s-]?deposit/i, /caution[\s-]?money/i,
  /पंजीकरण[\s-]?शुल्क/i,
];
const PII_REQ_PATTERNS = [
  /\baadhaar?\b/i, /\bpan[\s-]?card?\b/i, /\bbank[\s-]?account/i,
  /\bआधार\b/i, /\bपैन/i,
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as JobItem[];

    // Pull HR official email patterns from leak_patterns for recruiter verification
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const leak = (bundle.leak_patterns ?? {}) as { email_patterns?: string[] };
    const officialEmailDomains = (leak.email_patterns ?? [])
      .map((p) => p.replace(/^\*@/, "").toLowerCase())
      .filter((d) => d && !d.startsWith("TBD_"));

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const j of items) {
      const company = (j.company || j.companyName || j.employer || "").trim();
      const title = (j.jobTitle || j.title || "").toLowerCase();
      const desc = (j.description || j.jobDescription || "").toLowerCase();
      const url = j.jobUrl || j.url || "";
      const recruiterEmail = (j.recruiterEmail || "").toLowerCase();

      const text = `${title} ${desc} ${company.toLowerCase()}`;
      const matched = ctx.brand_keywords.filter((kw) => text.includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      // Recruiter on official-email domain → drop (legit hiring)
      const recruiterOfficial = recruiterEmail && officialEmailDomains.some((d) => recruiterEmail.endsWith(`@${d}`));
      if (recruiterOfficial) { dropped += 1; continue; }

      const feeHits = FEE_PATTERNS.filter((rx) => rx.test(desc));
      const piiHits = PII_REQ_PATTERNS.filter((rx) => rx.test(desc));

      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "recruitment_brand_use";
      if (feeHits.length > 0) { severity = "Critical"; fraudPattern = "recruitment_upfront_fee"; }
      else if (piiHits.length > 0) { severity = "Critical"; fraudPattern = "recruitment_pii_upfront"; }
      else if (!recruiterEmail) { fraudPattern = "recruitment_no_recruiter_contact"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: `apify:${j.source || "all-jobs"}`, kind: "fake_account",
        severity, confidence: 0.7,
        url_or_value: url,
        evidence: { company, title: j.jobTitle || j.title, location: j.location, recruiterEmail, postedDate: j.postedDate, fee_hits: feeHits.length, pii_hits: piiHits.length },
        feature_id: "FEAT-024", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: j.jobId || url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null, recommended_action: severity === "Critical" ? "investigate" : "monitor",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
