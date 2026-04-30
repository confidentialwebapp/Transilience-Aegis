// Stage 4 Composite scan with sync gate.
// Triggers Apify task AND Kali OSINT tools (sherlock + dnstwist + holehe via the
// Modal Kali endpoint) in parallel for a tenant, writes one composite_scan_arms
// row per arm, and returns immediately. Each arm reports completion back to the
// ledger; n8n's ingestion logic checks the ledger to know when to advance.
//
// This is the Apify+Kali fan-out the architecture spec calls for.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkCostGuard, estimateRunCost } from "@/lib/cost-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const APIFY_API = "https://api.apify.com/v2";
const KALI_API_BASE = process.env.NEXT_PUBLIC_OSINT_API_BASE ?? "https://transilience--aegis-osint-api-web.modal.run";

const APIFY_TASK_ID_CACHE: Record<string, string> = {
  "tai-aegis/creditaccessgrameen-feat-007-tier1-en": "ZZTlVWHn4DZhq8AgZ",
  "tai-aegis/creditaccessgrameen-feat-007-tier3-hi": "QQ1Bnf8fFqonm3APp",
  "tai-aegis/creditaccessgrameen-feat-019-whois": "pNleZydRebH4Q2ins",
  "tai-aegis/creditaccessgrameen-feat-022-defacement": "DtbyoEpN0OFL24ePz",
  "tai-aegis/creditaccessgrameen-feat-024-naukri": "CSAx4I7Tby3buSr13",
  "tai-aegis/creditaccessgrameen-feat-026-fake-branches": "98XdLWnzeJUk8GaoU",
  // FEAT-001 — Google Play Rogue App Detection per Phase 1 Step 10
  "creditaccessgrameen-feat-001-google-play-en": "zIDOVmO0qC3xgvDCY",
  "creditaccessgrameen-feat-001-google-play-hi": "janvSfh1TXg5mmnQB",
  "creditaccessgrameen-feat-001-google-play-kn": "92LkRMTkIFGPHpRMP",
};

interface AssetRow {
  type: string;
  value: string;
}

function buildApifyInput(featureId: string, assets: AssetRow[], baseTemplate: Record<string, unknown>): Record<string, unknown> {
  const domains = assets.filter((a) => a.type === "domain").map((a) => a.value);
  const subdomains = assets.filter((a) => a.type === "subdomain").map((a) => a.value);
  const brandNames = assets.filter((a) => a.type === "brand_name").map((a) => a.value);
  const keywords = assets.filter((a) => a.type === "keyword").map((a) => a.value);

  const out = { ...baseTemplate };
  switch (featureId) {
    case "FEAT-001": {
      // canadesk/google-play-store-ppe enum:
      //   ap=Search by AppId | se=Search by Keyword | pe=Get Permissions
      // For FEAT-001 rogue-app discovery we use "se" (search by keyword).
      // Strip metadata-only keys that leak from apify_tasks.config.
      delete (out as { apify_task_id?: unknown }).apify_task_id;
      delete (out as { label?: unknown }).label;
      const search = (brandNames[0] || keywords[0] || "").trim();
      out.process = "se";
      out.keyword = [search].filter(Boolean);
      out.country = "in";
      out.maximum = 30;
      break;
    }
    case "FEAT-002": {
      out.search = brandNames[0] || keywords[0] || "";
      break;
    }
    case "FEAT-007": {
      const queries = [...brandNames, ...keywords].filter(Boolean);
      if (queries.length) out.queries = queries.join("\n");
      break;
    }
    case "FEAT-019": {
      const allDomains = [...domains, ...subdomains, ...keywords.filter((k) => k.includes("."))];
      if (allDomains.length) out.domains = allDomains;
      break;
    }
    case "FEAT-022": {
      const startUrls = domains.map((d) => ({ url: `https://${d}/` }));
      if (startUrls.length) out.startUrls = startUrls;
      break;
    }
    case "FEAT-024": {
      out.keyword = brandNames.join(" OR ") || "loan officer";
      break;
    }
    case "FEAT-026": {
      const strings: string[] = [];
      for (const b of brandNames.slice(0, 3)) {
        strings.push(`${b} branch`);
        strings.push(`${b} office`);
      }
      if (strings.length) out.searchStringsArray = strings;
      break;
    }
  }
  return out;
}

/** Kali OSINT arm: fan out to Sherlock + dnstwist + holehe. Returns a list
 *  of {tool, ok, result|error} objects. Errors per-tool, not whole-arm. */
async function runKaliArm(assets: AssetRow[]): Promise<{ ok: boolean; results: unknown[]; errors: string[] }> {
  const brandHandles = assets
    .filter((a) => a.type === "social_handle" || a.type === "brand_name")
    .map((a) => a.value.toLowerCase().replace(/\s+/g, ""))
    .slice(0, 3);
  const domains = assets
    .filter((a) => a.type === "domain")
    .map((a) => a.value)
    .slice(0, 3);
  const emails = assets
    .filter((a) => a.type === "executive_email")
    .map((a) => a.value)
    .slice(0, 3);

  const calls: Promise<unknown>[] = [];
  const errors: string[] = [];

  // Sherlock per handle
  for (const h of brandHandles) {
    calls.push(
      fetch(`${KALI_API_BASE}/sherlock?username=${encodeURIComponent(h)}`, { method: "GET" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sherlock ${r.status}`))))
        .catch((e) => { errors.push(`sherlock(${h}): ${(e as Error).message}`); return null; }),
    );
  }
  // dnstwist per domain
  for (const d of domains) {
    calls.push(
      fetch(`${KALI_API_BASE}/dnstwist?domain=${encodeURIComponent(d)}`, { method: "GET" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`dnstwist ${r.status}`))))
        .catch((e) => { errors.push(`dnstwist(${d}): ${(e as Error).message}`); return null; }),
    );
  }
  // holehe per email
  for (const e of emails) {
    calls.push(
      fetch(`${KALI_API_BASE}/holehe?email=${encodeURIComponent(e)}`, { method: "GET" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`holehe ${r.status}`))))
        .catch((er) => { errors.push(`holehe(${e}): ${(er as Error).message}`); return null; }),
    );
  }

  if (calls.length === 0) {
    return { ok: true, results: [], errors: ["no Kali-relevant assets"] };
  }

  const settled = await Promise.allSettled(calls);
  const results = settled
    .map((s) => (s.status === "fulfilled" ? s.value : null))
    .filter((v) => v !== null);

  return { ok: errors.length === 0 || results.length > 0, results, errors };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      feature_id?: string;
      apify_task_id?: string;
      brand?: string;
      run_kali?: boolean;
      force?: boolean;
    };
    const { tenant_id, feature_id, apify_task_id, brand, run_kali } = body;

    if (!tenant_id || !feature_id || !apify_task_id) {
      return NextResponse.json({ ok: false, error: "tenant_id, feature_id, apify_task_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const apifyToken = process.env.APIFY_TOKEN!;
    if (!apifyToken) {
      return NextResponse.json({ ok: false, error: "APIFY_TOKEN not set" }, { status: 500 });
    }

    // Cost circuit breaker — refuse if Starter $29/mo cap would be breached.
    // Admin can pass {force: true} to override the soft-cap warning.
    const guard = await checkCostGuard(sb, tenant_id, estimateRunCost(feature_id), { adminOverride: body.force === true });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: `cost guard refused: ${guard.reason}`, guard }, { status: 402 });
    }

    // Read tenant + assets + apify task
    const [tenantRes, assetsRes, taskRes] = await Promise.all([
      sb.from("tenants").select("name, primary_brand, primary_domain").eq("id", tenant_id).single(),
      sb.from("aegis_assets").select("type, value, metadata").eq("tenant_id", tenant_id).eq("active", true),
      sb.from("apify_tasks").select("*").eq("task_id", apify_task_id).single(),
    ]);
    if (!taskRes.data) {
      return NextResponse.json({ ok: false, error: `apify_task ${apify_task_id} not found` }, { status: 404 });
    }
    const assets = (assetsRes.data ?? []) as AssetRow[];
    const tenantBrand = tenantRes.data?.primary_brand ?? brand ?? "Unknown";

    // Resolve Apify task id
    const apifyTaskApiId = APIFY_TASK_ID_CACHE[apify_task_id];
    if (!apifyTaskApiId) {
      return NextResponse.json({ ok: false, error: `Apify task id not cached for ${apify_task_id} — re-run apify/provision.py` }, { status: 500 });
    }

    // Open scan_runs + arms ledger
    const apifyInput = buildApifyInput(feature_id, assets, (taskRes.data.config as Record<string, unknown>) || {});
    const { data: scanRun, error: insErr } = await sb
      .from("scan_runs")
      .insert({
        tenant_id,
        brand: tenantBrand,
        service: feature_id.toLowerCase(),
        feature_id,
        apify_task_id,
        trigger: "admin_manual_full_sweep",
        status: "running",
        payload: { assets, input: apifyInput, run_kali: run_kali !== false },
      })
      .select("id")
      .single();
    if (insErr || !scanRun) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? "scan_runs insert failed" }, { status: 500 });
    }

    // Open both arms in the ledger (Apify + Kali if enabled)
    const armRows: { scan_run_id: string; arm: "apify" | "kali" }[] = [{ scan_run_id: scanRun.id, arm: "apify" }];
    if (run_kali !== false) armRows.push({ scan_run_id: scanRun.id, arm: "kali" });
    await sb.from("composite_scan_arms").insert(armRows);

    // ── Arm A: Apify (async — webhook will fire to n8n) ──
    const apifyResp = await fetch(
      `${APIFY_API}/actor-tasks/${apifyTaskApiId}/runs?token=${apifyToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apifyInput) },
    );
    if (!apifyResp.ok) {
      const err = await apifyResp.text();
      await sb.from("composite_scan_arms")
        .update({ status: "failed", error_message: err.slice(0, 400), completed_at: new Date().toISOString() })
        .eq("scan_run_id", scanRun.id).eq("arm", "apify");
    }
    const apifyJson = apifyResp.ok ? await apifyResp.json() : null;
    const apifyRunId: string | undefined = apifyJson?.data?.id;
    const apifyDatasetId: string | undefined = apifyJson?.data?.defaultDatasetId;

    if (apifyRunId) {
      await sb.from("scan_runs").update({ apify_run_id: apifyRunId }).eq("id", scanRun.id);
      await sb.from("composite_scan_arms")
        .update({ output_ref: apifyDatasetId ?? apifyRunId })
        .eq("scan_run_id", scanRun.id).eq("arm", "apify");
      await sb.from("apify_runs").insert({
        run_id: apifyRunId, tenant_id, feature_id, task_id: apify_task_id,
        trigger: "admin_manual_full_sweep", started_at: new Date().toISOString(),
        status: "RUNNING", dataset_id: apifyDatasetId,
      });
    }

    // ── Arm B: Kali (synchronous, runs in this request) ──
    let kaliSummary: unknown = null;
    if (run_kali !== false) {
      const kali = await runKaliArm(assets);
      kaliSummary = kali;
      // Persist Kali output into the ledger immediately so n8n / dashboard
      // sees it without waiting for Apify completion.
      await sb.from("composite_scan_arms").update({
        status: kali.ok ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        output_summary: { tool_results: kali.results, errors: kali.errors },
        error_message: kali.errors.length ? kali.errors.join("; ").slice(0, 400) : null,
      }).eq("scan_run_id", scanRun.id).eq("arm", "kali");

      // Convert each Kali tool result into findings rows directly (no n8n needed
      // for this arm — Kali runs are tiny, processing inline is faster).
      const findingRows: Record<string, unknown>[] = [];
      for (const r of kali.results) {
        const tool = (r as { tool?: string })?.tool;
        if (tool === "sherlock" || tool === "maigret-alias") {
          const hits = (r as { hits?: string[]; profiles?: string[] })?.hits
            ?? (r as { profiles?: string[] })?.profiles ?? [];
          const username = (r as { username?: string })?.username ?? "";
          for (const h of hits) {
            const url = (typeof h === "string" ? h.match(/https?:\/\/\S+/)?.[0] : null) ?? "";
            findingRows.push({
              tenant_id, scan_run_id: scanRun.id, source: `kali:${tool}`,
              kind: "username_squat", severity: "Moderate", confidence: 0.55,
              url_or_value: url || h, evidence: { raw: h, tool, username },
              ai_filtered: false, recommended_action: "monitor",
              feature_id, item_id: url || `${tool}:${username}:${h}`,
            });
          }
        } else if (tool === "holehe") {
          // Modal API returns {email, registered_count, registered_on: [...]}
          const email = (r as { email?: string }).email ?? "";
          const registered = (r as { registered_on?: string[] }).registered_on ?? [];
          for (const svc of registered) {
            // Filter out the noisy stderr-derived strings ("Email used, [-] ...")
            if (typeof svc !== "string" || svc.length > 60 || svc.includes("[")) continue;
            findingRows.push({
              tenant_id, scan_run_id: scanRun.id, source: "kali:holehe",
              kind: "leaked_asset", severity: "Substantial", confidence: 0.65,
              url_or_value: email, evidence: { service: svc, email },
              ai_filtered: false, recommended_action: "monitor", feature_id,
              item_id: `holehe:${email}:${svc}`,
            });
          }
        } else if (tool === "dnstwist") {
          // Each result row is a possible typosquat. Rows with dns_a populated
          // (and fuzzer != *original) are registered domains = real risk.
          const rows = (r as { results?: { domain: string; fuzzer: string; dns_a?: string[]; dns_ns?: string[] }[] }).results ?? [];
          for (const row of rows) {
            if (row.fuzzer === "*original") continue;
            const registered = Array.isArray(row.dns_a) && row.dns_a.length > 0;
            if (!registered) continue;
            findingRows.push({
              tenant_id, scan_run_id: scanRun.id, source: "kali:dnstwist",
              kind: "domain_typosquat",
              severity: registered ? "Substantial" : "Low",
              confidence: 0.7,
              url_or_value: row.domain,
              evidence: { fuzzer: row.fuzzer, dns_a: row.dns_a, dns_ns: row.dns_ns },
              ai_filtered: false,
              recommended_action: "investigate",
              feature_id, item_id: `dnstwist:${row.domain}`,
            });
          }
        }
      }
      if (findingRows.length > 0) {
        // Kali rows have null apify_task_id, so upsert-on-conflict against the
        // (apify_task_id, item_id) index collapses them. Plain insert is fine —
        // dedup happens at the AI filter step via cluster_key.
        const { error: kfErr } = await sb.from("findings").insert(findingRows);
        if (kfErr) {
          await sb.from("composite_scan_arms")
            .update({ error_message: `kali findings insert: ${kfErr.message.slice(0, 300)}` })
            .eq("scan_run_id", scanRun.id).eq("arm", "kali");
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scan_run_id: scanRun.id,
      apify_run_id: apifyRunId,
      apify_dataset_id: apifyDatasetId,
      kali_summary: kaliSummary,
      message: "Apify run started + Kali arm complete. Apify webhook will fire to n8n on completion. Customer dashboard updates live.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
