// Stage 3 — AI Planner.
// Takes the latest enrichment_run + the configured Apify tasks for the
// tenant, and produces an ordered scan plan: which feature_ids to run,
// in what order, with sequencing rules (e.g., FEAT-019 WHOIS feeds
// FEAT-007 SERP filtering).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaude, extractJson } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a brand-protection scan planner.

INPUT: a JSON object with:
  - enriched_bundle: the AI-enriched asset bundle (aliases, related_domains, fraud_lexicons, etc.)
  - available_features: array of {feature_id, feature_label, actor_id, language} that are
    provisioned and triggerable on demand
  - tenant_name, primary_domain, industry, country

YOUR JOB: Output an ordered scan plan that gets the most value
per Apify dollar (Starter plan: ~$0.15/scan, $49/mo budget).

OUTPUT (strict JSON only — no prose, no fences):
{
  "plan": [
    {
      "step": 1,
      "feature_id": "FEAT-XXX",
      "task_id": "<apify task slug>",
      "rationale": "<one sentence>",
      "depends_on_steps": [<int>, ...],   // optional; e.g. [1] means wait for step 1
      "kali_tools": [<tool>, ...]          // optional; runs in parallel via Modal Kali endpoint
    },
    ...
  ],
  "total_estimated_cost_usd": <number>,
  "rationale": "<one paragraph: why this order, what it covers, what it skips>"
}

PLANNING HEURISTICS:
- FEAT-019 (Domain WHOIS) is fast/cheap — run it FIRST so downstream
  features can reference fresh DNS / SSL state.
- FEAT-022 (Defacement) is on owned domains — run early as a baseline.
- FEAT-007 (SERP) is the highest-value broad scan — run all language tiers.
- FEAT-024 (Recruitment) and FEAT-026 (Fake Branches) are India-specific
  for NBFC/MFI customers — schedule them too.
- FEAT-001 (Google Play) is high-value but expensive — once daily is enough.
- Dependencies: if FEAT-019 surfaces a NEW typosquat domain, downstream
  FEAT-007 should re-scan with it as a query keyword (mark as depends_on).
- Kali tools (sherlock, dnstwist, holehe) run in PARALLEL with Apify, not
  serially — list them under the same step number where relevant.

CONSTRAINTS:
- Total estimated cost should not exceed $5 per full sweep.
- If available_features is empty, return {"plan": [], "rationale": "no provisioned tasks"}.
- Keep plan to ≤8 steps — quality over quantity.`;

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

    const [tenantRes, taskRes, enrichRes] = await Promise.all([
      sb.from("tenants").select("name, primary_brand, primary_domain").eq("id", tenant_id).single(),
      sb.from("apify_tasks").select("task_id, feature_id, feature_label, actor_id, language, active").eq("tenant_id", tenant_id),
      sb.from("enrichment_runs").select("id, enriched_bundle").eq("tenant_id", tenant_id).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!tenantRes.data) {
      return NextResponse.json({ ok: false, error: "tenant not found" }, { status: 404 });
    }
    const availableFeatures = ((taskRes.data ?? []) as Array<{ task_id: string; feature_id: string; feature_label: string; actor_id: string; language: string | null; active: boolean }>).filter((t) => t.active);
    const enrichmentRunId = enrichRes.data?.id ?? null;
    const enriched = enrichRes.data?.enriched_bundle ?? null;

    // Open planner_runs row
    const { data: runRow, error: runErr } = await sb
      .from("planner_runs")
      .insert({ tenant_id, enrichment_run_id: enrichmentRunId, status: "running" })
      .select("id")
      .single();
    if (runErr || !runRow) {
      return NextResponse.json({ ok: false, error: runErr?.message ?? "planner_runs insert failed" }, { status: 500 });
    }
    const runId = runRow.id;

    const userPayload = {
      tenant_name: tenantRes.data.name,
      primary_domain: tenantRes.data.primary_domain,
      industry: "nbfc_mfi",
      country: "IN",
      enriched_bundle: enriched ?? {},
      available_features: availableFeatures.map((f) => ({
        feature_id: f.feature_id,
        feature_label: f.feature_label,
        task_id: f.task_id,
        language: f.language,
      })),
    };

    let aiResp: { tokens_in: number; tokens_out: number; model: string; text: string } | null = null;
    let parsed: { plan?: unknown; total_estimated_cost_usd?: number; rationale?: string } | null = null;
    try {
      aiResp = await callClaude({
        system: SYSTEM_PROMPT,
        user: userPayload,
        maxTokens: 2500,
      });
      parsed = extractJson(aiResp.text);
      if (!parsed || !parsed.plan) {
        throw new Error("Planner returned malformed JSON");
      }
    } catch (e) {
      const msg = (e as Error).message;
      await sb.from("planner_runs").update({
        status: "failed", error_message: msg, completed_at: new Date().toISOString(),
        ai_model: aiResp?.model, ai_tokens_in: aiResp?.tokens_in, ai_tokens_out: aiResp?.tokens_out,
      }).eq("id", runId);
      return NextResponse.json({ ok: false, run_id: runId, error: msg }, { status: 500 });
    }

    await sb.from("planner_runs").update({
      status: "completed",
      scan_plan: parsed.plan,
      rationale: parsed.rationale ?? null,
      ai_model: aiResp.model,
      ai_tokens_in: aiResp.tokens_in,
      ai_tokens_out: aiResp.tokens_out,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return NextResponse.json({
      ok: true,
      run_id: runId,
      plan: parsed.plan,
      rationale: parsed.rationale,
      total_estimated_cost_usd: parsed.total_estimated_cost_usd,
      tokens: { in: aiResp.tokens_in, out: aiResp.tokens_out },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
