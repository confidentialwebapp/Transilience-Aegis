// FEAT-018 — GitHub secret leak monitoring.
// Uses GitHub Search API directly (no Apify needed). Searches for
// secret_prefixes from leak_patterns + employee email domains in code.
//
// GitHub token comes from env GITHUB_SEARCH_TOKEN (read-only PAT).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GhCodeItem {
  name?: string; path?: string; html_url?: string; sha?: string;
  repository?: { full_name?: string; private?: boolean };
  text_matches?: { fragment?: string; matches?: { text?: string }[] }[];
}

async function ghSearch(query: string, ghToken: string): Promise<GhCodeItem[]> {
  const r = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=30`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github.text-match+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { items?: GhCodeItem[] };
  return j.items ?? [];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; scan_run_id?: string };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const ghToken = process.env.GITHUB_SEARCH_TOKEN || "";
    if (!ghToken) return NextResponse.json({ ok: false, error: "GITHUB_SEARCH_TOKEN not set" }, { status: 500 });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await loadCustomerCtx(sb, tenant_id);
    const { data: ca } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenant_id).maybeSingle();
    const bundle = (ca?.asset_bundle ?? {}) as Record<string, unknown>;
    const leak = (bundle.leak_patterns ?? {}) as { secret_prefixes?: string[]; email_patterns?: string[] };
    const secretPrefixes = (leak.secret_prefixes ?? []).filter((s) => s && !s.startsWith("TBD_"));
    const emailDomains = (leak.email_patterns ?? []).map((p) => p.replace(/^\*@/, "").toLowerCase()).filter((d) => d && !d.startsWith("TBD_"));

    if (secretPrefixes.length === 0 && emailDomains.length === 0) {
      return NextResponse.json({ ok: false, error: "no secret_prefixes or email_patterns configured (TBD_* placeholders blocked)" }, { status: 400 });
    }

    const findingRows: Record<string, unknown>[] = [];
    const queries = [...secretPrefixes.map((p) => `"${p}"`), ...emailDomains.map((d) => `"@${d}"`)];

    for (const q of queries.slice(0, 6)) {
      const items = await ghSearch(q, ghToken);
      for (const it of items) {
        const repo = it.repository?.full_name ?? "";
        if (it.repository?.private) continue;
        const url = it.html_url ?? "";
        const fragment = it.text_matches?.[0]?.fragment ?? "";
        findingRows.push({
          tenant_id, scan_run_id: body.scan_run_id ?? null,
          source: "github:search-code", kind: "credential_leak",
          severity: "Critical", confidence: 0.9,
          url_or_value: url,
          evidence: { repo, file: it.path, sha: it.sha, fragment: fragment.slice(0, 500), query: q },
          feature_id: "FEAT-018", apify_task_id: "creditaccessgrameen-feat-018-github",
          item_id: `${repo}:${it.sha}`,
          fraud_pattern: "github_secret_or_employee_email_leak",
          matched_keywords: [q],
          ai_filter_status: null,
          recommended_action: "compliance_escalation",
        });
      }
      // GitHub rate limits — modest delay
      await new Promise((res) => setTimeout(res, 1000));
    }

    const result = await insertFindingsDedupe(sb, "creditaccessgrameen-feat-018-github", findingRows);
    return NextResponse.json({ ok: true, queries_run: queries.length, findings: findingRows.length, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
