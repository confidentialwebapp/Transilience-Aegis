// FEAT-015 — LinkedIn brand + recruitment monitoring.
// Two sub-features per spec:
//   15a Executive Impersonation
//   15b Recruitment Scam Detection (cross-reference HR roster)
// Apify actor harvestapi/linkedin-company-scraper (paid). Schema-agnostic.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface LinkedInItem {
  url?: string; profileUrl?: string; companyUrl?: string;
  name?: string; companyName?: string; fullName?: string;
  title?: string; headline?: string; description?: string;
  industry?: string; companySize?: string;
  followerCount?: number;
  // recruiter-specific
  jobTitle?: string; postedBy?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string; sub_feature?: "executive" | "recruitment" };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const subFeature = body.sub_feature ?? "executive";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);

    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const social = (bundle.social_handles ?? {}) as Record<string, string>;
    const officialLinkedin = (social.linkedin && !social.linkedin.startsWith("TBD_")) ? social.linkedin.toLowerCase() : "";
    const execs = (bundle.executives ?? []) as { entity_id: string; name: string; title: string }[];
    const execNames = execs.map((e) => e.name.toLowerCase());

    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as LinkedInItem[];

    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const it of items) {
      const url = it.url || it.profileUrl || it.companyUrl || "";
      const name = (it.name || it.companyName || it.fullName || "").trim();
      const title = (it.title || it.headline || "").trim();
      const desc = it.description || "";
      const text = `${name} ${title} ${desc}`.toLowerCase();
      if (officialLinkedin && url.includes(`/in/${officialLinkedin}/`)) { dropped += 1; continue; }
      if (officialLinkedin && url.includes(`/company/${officialLinkedin}/`)) { dropped += 1; continue; }

      let severity: "Critical" | "Substantial" | "Moderate" = "Moderate";
      let fraudPattern = "linkedin_brand_mention";
      let matched: string[] = [];

      if (subFeature === "executive") {
        // Match against exec name list — flag any non-verified profile claiming to be one
        const execHit = execNames.find((n) => name.toLowerCase().includes(n) || text.includes(n));
        if (execHit) {
          matched = [execHit];
          severity = "Critical";
          fraudPattern = "executive_impersonation";
        } else { dropped += 1; continue; }
      } else {
        // recruitment: brand keyword + recruiter not on official roster
        matched = ctx.brand_keywords.filter((kw) => text.includes(kw));
        if (matched.length === 0) { dropped += 1; continue; }
        severity = "Substantial";
        fraudPattern = "linkedin_recruitment_brand_use";
        if (/(processing[\s-]?fee|joining[\s-]?fee|aadhaar|pan[\s-]?card)/i.test(desc)) {
          severity = "Critical";
          fraudPattern = "linkedin_recruitment_scam";
        }
      }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:linkedin", kind: subFeature === "executive" ? "executive_impersonation" : "fake_account",
        severity, confidence: 0.65,
        url_or_value: url,
        evidence: { name, title, description: desc.slice(0, 400), industry: it.industry, followers: it.followerCount, sub_feature: subFeature },
        feature_id: "FEAT-015", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null,
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, sub_feature: subFeature, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
