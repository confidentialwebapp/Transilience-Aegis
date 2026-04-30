// Stage 2 — AI Asset Enricher.
// Reads tenant's raw assets, calls Anthropic to discover aliases / related
// entities / fraud lexicons, and writes the enriched bundle back to Supabase.
// Result is stored in `enrichment_runs`; new asset rows are added to
// `aegis_assets` with discovered_by='ai_enricher'.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaude, extractJson } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;  // Vercel function timeout

const SYSTEM_PROMPT = `You are an asset-enrichment analyst for a brand-protection platform.

INPUT: a JSON object with a tenant's brand portfolio:
  - primary_brand, primary_domain
  - existing assets (domains, subdomains, brand_names, social_handles, mobile_apps, executive_emails, executive_handles, keywords, BINs)
  - country, languages, industry

YOUR JOB: Expand this into the COMPLETE attack surface a brand-protection
SOC needs to monitor. Be aggressive but precise — every entry you propose
must be DEFENSIBLE.

OUTPUT (strict JSON only, no prose, no markdown fences):
{
  "aliases": [<string>, ...],            // historical names, common abbreviations
  "misspellings": [<string>, ...],       // hyphenations, missing letters, common typos
  "transliterations": [{"language": "<ISO>", "value": "<text>"}, ...],
  "related_entities": [{"type": "<parent|subsidiary|division|product>", "name": "<text>"}, ...],
  "related_domains": [<string>, ...],    // group-level / sister brand domains
  "domain_typosquats": [<string>, ...],  // Levenshtein-1 / homoglyph / hyphenation variants of primary_domain
  "fraud_lexicons": {
    "loan_scam_<lang>": [<string>, ...],
    "recovery_scam_<lang>": [<string>, ...],
    "job_scam_<lang>": [<string>, ...]
  },
  "missing_fields": [<string>, ...],    // TBDs the customer must supply (e.g. "official APK signing cert SHA256")
  "rationale": "<one short paragraph>"
}

CONSTRAINTS:
- Produce content for EVERY language listed in input.languages (Hindi/Kannada/Tamil/Telugu/Marathi/Bengali for Indian customers).
- If the brand has a known historical name (e.g. CreditAccess Grameen → Grameen Koota / Madura Micro Finance), include it.
- Domain typosquats should be plausible (not random) — focus on letter swaps adjacent on QWERTY, hyphenation, TLD swap (.in → .com, etc).
- Fraud lexicons should reflect the industry (NBFC/MFI/Bank → loan/recovery/recruitment scams).
- Keep arrays under 30 items each. Quality over quantity.`;

interface AssetRow {
  type: string;
  value: string;
  metadata: Record<string, unknown> | null;
}

export async function POST(req: NextRequest) {
  try {
    const { tenant_id } = (await req.json()) as { tenant_id?: string };
    if (!tenant_id) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Read tenant + assets
    const [tenantRes, assetsRes] = await Promise.all([
      sb.from("tenants").select("name, primary_brand, primary_domain, status").eq("id", tenant_id).single(),
      sb.from("aegis_assets").select("type, value, metadata").eq("tenant_id", tenant_id).eq("active", true),
    ]);

    if (!tenantRes.data) {
      return NextResponse.json({ ok: false, error: "tenant not found" }, { status: 404 });
    }
    const tenant = tenantRes.data;
    const assets = (assetsRes.data ?? []) as AssetRow[];

    // Build the user payload for Claude — keep tight, no irrelevant cruft
    const rawBundle = {
      tenant_name: tenant.name,
      primary_brand: tenant.primary_brand,
      primary_domain: tenant.primary_domain,
      industry: "nbfc_mfi", // hardcoded for CA Grameen demo; later derived from tenant.metadata
      country: "IN",
      languages: ["en", "hi", "kn", "ta", "te", "mr", "bn"],
      assets: assets.map((a) => ({ type: a.type, value: a.value })),
    };

    // Open enrichment_runs row
    const { data: runRow, error: runErr } = await sb
      .from("enrichment_runs")
      .insert({ tenant_id, status: "running", raw_bundle: rawBundle })
      .select("id")
      .single();
    if (runErr || !runRow) {
      return NextResponse.json({ ok: false, error: runErr?.message ?? "enrichment_runs insert failed" }, { status: 500 });
    }
    const runId = runRow.id;

    let enriched: unknown = null;
    let aiResp: { tokens_in: number; tokens_out: number; model: string; text: string } | null = null;
    try {
      aiResp = await callClaude({
        system: SYSTEM_PROMPT,
        user: rawBundle,
        maxTokens: 3000,
      });
      enriched = extractJson(aiResp.text);
      if (!enriched) {
        throw new Error("Could not parse JSON from Claude response: " + aiResp.text.slice(0, 200));
      }
    } catch (e) {
      const msg = (e as Error).message;
      await sb.from("enrichment_runs").update({
        status: "failed", error_message: msg, completed_at: new Date().toISOString(),
        ai_model: aiResp?.model, ai_tokens_in: aiResp?.tokens_in, ai_tokens_out: aiResp?.tokens_out,
      }).eq("id", runId);
      return NextResponse.json({ ok: false, run_id: runId, error: msg }, { status: 500 });
    }

    // Mark enrichment_runs completed
    await sb.from("enrichment_runs").update({
      status: "completed",
      enriched_bundle: enriched,
      ai_model: aiResp.model,
      ai_tokens_in: aiResp.tokens_in,
      ai_tokens_out: aiResp.tokens_out,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Insert new aegis_assets rows for AI-discovered entities (dedup against existing values)
    const existingValues = new Set(assets.map((a) => `${a.type}|${a.value.toLowerCase()}`));
    const newRows: { tenant_id: string; type: string; value: string; metadata: object; discovered_by: string; enrichment_run_id: string }[] = [];

    const enr = enriched as Record<string, unknown>;
    const pushIfNew = (type: string, value: string, meta: object = {}) => {
      const key = `${type}|${value.toLowerCase()}`;
      if (existingValues.has(key)) return;
      existingValues.add(key);
      newRows.push({
        tenant_id,
        type,
        value,
        metadata: meta,
        discovered_by: "ai_enricher",
        enrichment_run_id: runId,
      });
    };

    for (const a of (enr.aliases as string[] | undefined) ?? []) pushIfNew("brand_name", a, { kind: "alias" });
    for (const m of (enr.misspellings as string[] | undefined) ?? []) pushIfNew("keyword", m, { kind: "misspelling" });
    for (const tr of (enr.transliterations as { language: string; value: string }[] | undefined) ?? []) {
      pushIfNew("brand_name", tr.value, { kind: "transliteration", language: tr.language });
    }
    for (const d of (enr.related_domains as string[] | undefined) ?? []) pushIfNew("domain", d, { kind: "related" });
    for (const t of (enr.domain_typosquats as string[] | undefined) ?? []) pushIfNew("keyword", t, { kind: "typosquat" });

    let inserted = 0;
    if (newRows.length > 0) {
      const { count } = await sb.from("aegis_assets").insert(newRows).select("id", { count: "exact", head: true });
      inserted = count ?? newRows.length;
    }

    return NextResponse.json({
      ok: true,
      run_id: runId,
      enriched,
      inserted_assets: inserted,
      tokens: { in: aiResp.tokens_in, out: aiResp.tokens_out },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
