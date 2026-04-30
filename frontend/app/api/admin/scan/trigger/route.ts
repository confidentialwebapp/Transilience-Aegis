// Admin-triggered scan starter.
// Reads customer assets from Supabase, builds the Apify input from those assets,
// starts the Apify task asynchronously, and returns the run_id immediately.
// Apify will fire its webhook to n8n on completion → n8n ingests + classifies +
// upserts findings → customer dashboard sees them via Realtime.
//
// No schedules; nothing runs autonomously. Costs scale with admin clicks.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const APIFY_API = "https://api.apify.com/v2";

// Map our internal task_id to Apify's actor-task id (returned by Apify on creation).
// Could be discovered at runtime via /v2/actor-tasks?search=... but we'd hit it on
// every request — so we cache the mapping. If a task isn't here yet, fall back to
// Apify task-name lookup.
const APIFY_TASK_ID_CACHE: Record<string, string> = {
  "tai-aegis/creditaccessgrameen-feat-007-tier1-en": "ZZTlVWHn4DZhq8AgZ",
  "tai-aegis/creditaccessgrameen-feat-007-tier3-hi": "QQ1Bnf8fFqonm3APp",
  "tai-aegis/creditaccessgrameen-feat-019-whois": "pNleZydRebH4Q2ins",
  "tai-aegis/creditaccessgrameen-feat-022-defacement": "DtbyoEpN0OFL24ePz",
  "tai-aegis/creditaccessgrameen-feat-024-naukri": "CSAx4I7Tby3buSr13",
  "tai-aegis/creditaccessgrameen-feat-026-fake-branches": "98XdLWnzeJUk8GaoU",
};

interface AssetRow {
  type: string;
  value: string;
  metadata: Record<string, unknown> | null;
}

async function lookupApifyTaskByName(name: string): Promise<string | null> {
  const token = process.env.APIFY_TOKEN!;
  const flat = name.split("/").pop()!;
  const r = await fetch(
    `${APIFY_API}/actor-tasks?token=${token}&limit=1000`,
  );
  if (!r.ok) return null;
  const j = await r.json();
  const items: Array<{ id: string; name: string }> = j?.data?.items ?? [];
  const found = items.find((i) => i.name === flat || i.name === name);
  return found?.id ?? null;
}

/** Build the Apify input from the customer's assets, per-feature. */
function buildApifyInput(featureId: string, assets: AssetRow[], baseTemplate: Record<string, unknown>, keywordOverride?: string): Record<string, unknown> {
  const domains = assets.filter((a) => a.type === "domain").map((a) => a.value);
  const subdomains = assets.filter((a) => a.type === "subdomain").map((a) => a.value);
  const brandNames = assets.filter((a) => a.type === "brand_name").map((a) => a.value);
  const handles = assets.filter((a) => a.type === "social_handle").map((a) => a.value);
  const keywords = assets.filter((a) => a.type === "keyword").map((a) => a.value);
  const execEmails = assets.filter((a) => a.type === "executive_email").map((a) => a.value);

  const out = { ...baseTemplate };

  switch (featureId) {
    case "FEAT-001":
    case "FEAT-002": {
      // Apify google/app-store scraper: search by brand keyword
      const kw = keywordOverride || keywords[0] || brandNames[0] || "";
      out.search = kw;
      break;
    }
    case "FEAT-007": {
      // SERP scraper: queries are newline-delimited
      const queries = keywordOverride
        ? [keywordOverride]
        : [...brandNames, ...keywords].filter(Boolean);
      if (queries.length > 0) out.queries = queries.join("\n");
      break;
    }
    case "FEAT-019": {
      // Bulk WHOIS: feed all owned domains + typosquat keywords that look like domains
      const allDomains = [
        ...domains,
        ...subdomains,
        ...keywords.filter((k) => k.includes(".")),
      ];
      if (allDomains.length > 0) out.domains = allDomains;
      break;
    }
    case "FEAT-022": {
      // Defacement: build startUrls from owned domains
      const startUrls = domains.map((d) => ({ url: `https://${d}/` }));
      if (startUrls.length > 0) out.startUrls = startUrls;
      break;
    }
    case "FEAT-024": {
      // Recruitment scams: keyword built from brand names
      const kw = keywordOverride || brandNames.join(" OR ") || "loan officer";
      out.keyword = kw;
      break;
    }
    case "FEAT-026": {
      // Fake branches: search strings for each brand × city
      const strings: string[] = [];
      for (const b of brandNames.slice(0, 3)) {
        strings.push(`${b} branch`);
        strings.push(`${b} office`);
      }
      if (strings.length > 0) out.searchStringsArray = strings;
      break;
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, feature_id, apify_task_id, brand, keyword_override } = body as {
      tenant_id?: string;
      feature_id?: string;
      apify_task_id?: string;
      brand?: string;
      keyword_override?: string;
    };

    if (!tenant_id || !feature_id || !apify_task_id) {
      return NextResponse.json({ ok: false, error: "tenant_id, feature_id, apify_task_id required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const apifyToken = process.env.APIFY_TOKEN!;

    if (!apifyToken) {
      return NextResponse.json({ ok: false, error: "APIFY_TOKEN not configured" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Read customer assets
    const { data: assets } = await sb
      .from("aegis_assets")
      .select("type, value, metadata")
      .eq("tenant_id", tenant_id)
      .eq("active", true);

    // 2. Read tenant + apify task config
    const [tenantRes, taskRes] = await Promise.all([
      sb.from("tenants").select("name, primary_brand, primary_domain").eq("id", tenant_id).single(),
      sb.from("apify_tasks").select("*").eq("task_id", apify_task_id).single(),
    ]);

    if (!taskRes.data) {
      return NextResponse.json({ ok: false, error: "apify_task not found in DB" }, { status: 404 });
    }

    const taskCfg = taskRes.data;
    const tenantBrand = tenantRes.data?.primary_brand ?? brand ?? "Unknown";

    // 3. Resolve Apify task id (cache or lookup)
    let apifyTaskApiId = APIFY_TASK_ID_CACHE[apify_task_id];
    if (!apifyTaskApiId) {
      const looked = await lookupApifyTaskByName(apify_task_id);
      if (!looked) {
        return NextResponse.json(
          { ok: false, error: `Apify task ${apify_task_id} not provisioned. Run apify/provision.py first.` },
          { status: 500 },
        );
      }
      apifyTaskApiId = looked;
    }

    // 4. Build the Apify input from assets + base template
    const baseInput = (taskCfg.config as Record<string, unknown>) || {};
    const apifyInput = buildApifyInput(feature_id, (assets ?? []) as AssetRow[], baseInput, keyword_override);

    // 5. Insert scan_runs row
    const { data: scanRun, error: insErr } = await sb
      .from("scan_runs")
      .insert({
        tenant_id,
        brand: tenantBrand,
        service: feature_id.toLowerCase().replace("feat-", "service_"),
        feature_id,
        apify_task_id,
        trigger: "admin_manual",
        status: "running",
        payload: { assets: assets ?? [], input: apifyInput, keyword_override },
      })
      .select("id")
      .single();

    if (insErr || !scanRun) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? "scan_runs insert failed" }, { status: 500 });
    }

    // 6. Trigger Apify run asynchronously (fire-and-forget — Apify webhook will deliver to n8n)
    const runResp = await fetch(
      `${APIFY_API}/actor-tasks/${apifyTaskApiId}/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput),
      },
    );

    if (!runResp.ok) {
      const errBody = await runResp.text();
      // Mark scan_runs failed
      await sb.from("scan_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", scanRun.id);
      return NextResponse.json(
        { ok: false, scan_run_id: scanRun.id, error: `Apify ${runResp.status}: ${errBody.slice(0, 300)}` },
        { status: 500 },
      );
    }

    const runJson = await runResp.json();
    const apifyRunId: string = runJson?.data?.id;
    const apifyDatasetId: string | undefined = runJson?.data?.defaultDatasetId;

    // 7. Update scan_runs with apify_run_id
    await sb
      .from("scan_runs")
      .update({ apify_run_id: apifyRunId, payload: { ...(scanRun as unknown as { payload?: object }).payload ?? {}, apify_run_id: apifyRunId, apify_dataset_id: apifyDatasetId } })
      .eq("id", scanRun.id);

    // 8. Insert apify_runs ledger
    await sb.from("apify_runs").insert({
      run_id: apifyRunId,
      tenant_id,
      feature_id,
      task_id: apify_task_id,
      trigger: "admin_manual",
      started_at: new Date().toISOString(),
      status: "RUNNING",
      dataset_id: apifyDatasetId,
    }).select();

    return NextResponse.json({
      ok: true,
      scan_run_id: scanRun.id,
      apify_run_id: apifyRunId,
      apify_dataset_id: apifyDatasetId,
      message:
        "Apify run started. Webhook will fire to n8n on completion (~30-90s for SERP, longer for crawlers). Customer dashboard updates live.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
