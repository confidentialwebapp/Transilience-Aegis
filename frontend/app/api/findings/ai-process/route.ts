// Stages 6 + 7 combined — AI Filter + Dashboard Prep + Incident grouping.
// Fired AFTER ingestion completes. Reads unprocessed findings for a scan_run,
// runs them through Anthropic for false-positive removal + summary + risk
// score, groups related rows into incidents, writes everything back.
//
// Idempotent — safe to retry. Uses ai_filter_status to avoid re-processing.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaude, extractJson } from "@/lib/anthropic";
import { attributeFinding, loadTrustGraph,
  AUTO_SUPPRESS_DECISIONS, AUTO_ELEVATE_DECISIONS } from "@/lib/attribution/skill";
import type { FindingForAttribution } from "@/lib/attribution/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FILTER_PROMPT = `You are a brand-protection analyst running false-positive removal on raw OSINT findings.

INPUT: a JSON object with:
  - tenant: { name, primary_brand, primary_domain, owned_domains, whitelisted_handles, country }
  - findings: array of {id, source, kind, severity, url_or_value, evidence}

YOUR JOB: For EACH finding, output a verdict object:
{
  "id": "<original finding id>",
  "is_false_positive": true | false,
  "confidence": 0..1,
  "reasoning": "<one short sentence>",
  "suggested_severity": "Critical" | "Substantial" | "Moderate" | "Low",
  "ai_summary": "<one short readable sentence about what this finding represents>",
  "recommended_action": "takedown" | "monitor" | "notify_user" | "drop",
  "cluster_key": "<short string for grouping; e.g. asn-13335, host-example.com, actor-LockBit, kind-job_scam>"
}

Drop ruthlessly:
- URL host is in tenant.owned_domains → is_false_positive=true, recommended_action="drop"
- Handle in tenant.whitelisted_handles → is_false_positive=true
- Legit news/regulatory mentions of the brand → is_false_positive=true
- Sherlock hits on common platforms when username is generic → is_false_positive=true (unless brand-exact)

Keep + escalate:
- Phishing pages capturing creds → Critical, takedown
- Fake apps in stores → Substantial, takedown if Critical permissions
- Fake branches with red reviews → Substantial, monitor
- Recruitment scams asking for fees → Critical, takedown
- HIBP credential breaches with passwords → Critical, notify_user

cluster_key heuristic:
- Same hosting domain → "host-<domain>"
- Same fraud_pattern → "kind-<pattern>"
- Domain typosquats of same root → "typo-<root>"
- Sherlock username on multi sites → "username-<handle>"
- Default to "fid-<feature_id>" if unsure

OUTPUT: a strict JSON array of verdict objects (one per input finding). No prose, no fences.`;

interface FindingRow {
  id: string;
  scan_run_id: string;
  tenant_id: string;
  source: string;
  kind: string;
  severity: string;
  confidence: number | null;
  url_or_value: string | null;
  evidence: Record<string, unknown> | null;
  feature_id: string | null;
  ai_filter_status: string | null;
}

interface Verdict {
  id: string;
  is_false_positive: boolean;
  confidence?: number;
  reasoning?: string;
  suggested_severity?: string;
  ai_summary?: string;
  recommended_action?: string;
  cluster_key?: string;
}

const SEV_RANK: Record<string, number> = { Critical: 100, Substantial: 75, Moderate: 50, Low: 25 };

export async function POST(req: NextRequest) {
  try {
    const { scan_run_id, tenant_id, max_findings } = (await req.json()) as {
      scan_run_id?: string;
      tenant_id?: string;
      max_findings?: number;
    };
    if (!scan_run_id && !tenant_id) {
      return NextResponse.json({ ok: false, error: "scan_run_id or tenant_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const limit = Math.min(max_findings ?? 80, 200);

    // 1. Read pending findings (ai_filter_status IS NULL)
    let q = sb.from("findings").select("*").is("ai_filter_status", null).limit(limit);
    if (scan_run_id) q = q.eq("scan_run_id", scan_run_id);
    if (tenant_id) q = q.eq("tenant_id", tenant_id);
    const { data: findingsData } = await q;
    let findings = (findingsData ?? []) as FindingRow[];
    if (findings.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "no pending findings" });
    }
    const tenantIdResolved = findings[0].tenant_id;

    // 1b. v5 — Attribution Skill pre-pass.
    // For each finding, resolve against the customer's Trust Graph BEFORE
    // sending to the AI false-positive filter. Auto-suppress / auto-elevate
    // findings the skill is sure about; only the remainder reaches the AI
    // filter (cuts AI cost ~30-60% on a stable Trust Graph).
    let attribStats = { suppressed: 0, elevated: 0, passed_through: 0, ai_fallback: 0, cache_hits: 0 };
    const attribLoad = await loadTrustGraph(sb, tenantIdResolved);
    const remainingForAi: FindingRow[] = [];
    if ("ctx" in attribLoad) {
      const ctx = attribLoad.ctx;
      // Parallelize attribution; the skill itself is independent per finding.
      const CONC = 6;
      for (let start = 0; start < findings.length; start += CONC) {
        const chunk = findings.slice(start, start + CONC);
        const outs = await Promise.allSettled(chunk.map((f) => {
          const ev = (f.evidence ?? {}) as { content?: string; title?: string; description?: string; raw?: string };
          return attributeFinding(sb, ctx, {
            finding_id: f.id, feature_id: f.feature_id, source: f.source,
            url: f.url_or_value, title: ev.title ?? null,
            content: ev.content ?? ev.description ?? ev.raw ?? null,
            timestamp_source: null,
          } as FindingForAttribution);
        }));
        for (let i = 0; i < outs.length; i++) {
          const s = outs[i];
          const f = chunk[i];
          if (s.status === "rejected") { remainingForAi.push(f); continue; }
          const out = s.value;
          if (out.audit.resolver === "ai_fallback") attribStats.ai_fallback += 1;
          if (out.audit.resolver === "cache") attribStats.cache_hits += 1;
          if (AUTO_SUPPRESS_DECISIONS.has(out.decision)) {
            await sb.from("findings").update({
              ai_filter_status: "dropped",
              ai_summary: out.reason.slice(0, 200),
              ai_reason: `Auto-suppressed by attribution skill (${out.decision}).`,
              recommended_action: "drop", severity: "Low", final_risk_score: 0,
            }).eq("id", f.id);
            attribStats.suppressed += 1; continue;
          }
          if (AUTO_ELEVATE_DECISIONS.has(out.decision)) {
            await sb.from("findings").update({
              ai_filter_status: "kept",
              ai_summary: out.reason.slice(0, 200),
              ai_reason: `Auto-elevated by attribution skill (${out.decision}).`,
              recommended_action: "takedown", severity: "Critical", final_risk_score: 95,
              fraud_pattern: out.new_fraud_pattern ?? f.fraud_pattern,
            }).eq("id", f.id);
            attribStats.elevated += 1; continue;
          }
          remainingForAi.push(f);
          attribStats.passed_through += 1;
        }
      }
      findings = remainingForAi;
    }
    if (findings.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: attribStats.suppressed + attribStats.elevated,
        kept: attribStats.elevated, dropped: attribStats.suppressed,
        review: 0, skipped: 0, unmatched_by_id: 0,
        attribution: attribStats,
        incidents_created: 0, incidents_updated: 0,
        message: "all findings resolved by attribution skill; AI filter not needed.",
      });
    }

    // 2. Read tenant context
    const { data: tenant } = await sb
      .from("tenants")
      .select("name, primary_brand, primary_domain")
      .eq("id", tenantIdResolved)
      .single();
    const { data: assets } = await sb
      .from("aegis_assets")
      .select("type, value")
      .eq("tenant_id", tenantIdResolved)
      .eq("active", true);
    const ownedDomains = (assets ?? [])
      .filter((a) => a.type === "domain" || a.type === "subdomain")
      .map((a) => a.value);
    const whitelistedHandles = (assets ?? [])
      .filter((a) => a.type === "social_handle")
      .map((a) => a.value.toLowerCase());

    // 3. Call Anthropic
    const userPayload = {
      tenant: {
        name: tenant?.name,
        primary_brand: tenant?.primary_brand,
        primary_domain: tenant?.primary_domain,
        owned_domains: ownedDomains,
        whitelisted_handles: whitelistedHandles,
        country: "IN",
      },
      findings: findings.map((f) => ({
        id: f.id,
        source: f.source,
        kind: f.kind,
        severity: f.severity,
        url_or_value: f.url_or_value,
        evidence: f.evidence,
      })),
    };

    // ~150 tokens per verdict × findings, plus framing slack.
    const budget = Math.min(8000, 800 + findings.length * 180);
    const aiResp = await callClaude({ system: FILTER_PROMPT, user: userPayload, maxTokens: budget });
    const parsed = extractJson<Verdict[] | { verdicts?: Verdict[]; results?: Verdict[] }>(aiResp.text);
    let verdicts: Verdict[] | null = null;
    if (Array.isArray(parsed)) verdicts = parsed;
    else if (parsed && typeof parsed === "object") {
      const obj = parsed as { verdicts?: Verdict[]; results?: Verdict[] };
      verdicts = obj.verdicts ?? obj.results ?? null;
    }
    if (!verdicts || !Array.isArray(verdicts) || verdicts.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "AI returned malformed JSON",
        debug: {
          stop_reason: aiResp.stop_reason,
          tokens: { in: aiResp.tokens_in, out: aiResp.tokens_out },
          budget,
          response_head: aiResp.text.slice(0, 400),
          response_tail: aiResp.text.slice(-300),
        },
      }, { status: 500 });
    }
    // Match verdicts to findings: prefer id-keyed lookup, but fall back to
    // positional alignment when Claude truncates or rewrites the id (which
    // happens in practice with long UUIDs and tight token budgets).
    const verdictMap = new Map<string, Verdict>(
      verdicts.filter((v) => v.id).map((v) => [v.id, v]),
    );

    // 4. Apply verdicts: update findings, group into incidents
    const incidentBuckets = new Map<string, { findings: FindingRow[]; verdicts: Verdict[]; severity: string }>();

    let unmatchedById = 0;
    let writesKept = 0, writesDropped = 0, writesReview = 0, writesSkipped = 0;
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      let v = verdictMap.get(f.id);
      if (!v && verdicts.length === findings.length) {
        v = verdicts[i];
        unmatchedById += 1;
      }
      if (!v) { writesSkipped += 1; continue; }
      const status = v.is_false_positive ? (v.confidence && v.confidence > 0.85 ? "dropped" : "review") : "kept";
      const severity = v.suggested_severity ?? f.severity;
      const finalRisk = (SEV_RANK[severity] ?? 25) * (v.confidence ?? 0.5);

      const { error: updErr } = await sb.from("findings").update({
        ai_filter_status: status,
        ai_summary: v.ai_summary ?? null,
        ai_reason: v.reasoning ?? null,
        recommended_action: v.recommended_action ?? null,
        severity,
        confidence: v.confidence ?? f.confidence,
        final_risk_score: finalRisk,
      }).eq("id", f.id);
      if (updErr) { writesSkipped += 1; continue; }
      if (status === "kept") writesKept += 1;
      else if (status === "dropped") writesDropped += 1;
      else writesReview += 1;

      // Group by cluster_key (skip false positives — they don't need incidents)
      if (status !== "dropped" && v.cluster_key) {
        if (!incidentBuckets.has(v.cluster_key)) {
          incidentBuckets.set(v.cluster_key, { findings: [], verdicts: [], severity });
        }
        const b = incidentBuckets.get(v.cluster_key)!;
        b.findings.push(f);
        b.verdicts.push(v);
        // Bucket severity = max severity in bucket
        if ((SEV_RANK[severity] ?? 0) > (SEV_RANK[b.severity] ?? 0)) {
          b.severity = severity;
        }
      }
    }

    // 5. Create or update incidents
    let incidentsCreated = 0;
    let incidentsUpdated = 0;
    for (const [clusterKey, bucket] of incidentBuckets.entries()) {
      const existing = await sb
        .from("incidents")
        .select("id, finding_count")
        .eq("tenant_id", tenantIdResolved)
        .eq("cluster_key", clusterKey)
        .eq("status", "open")
        .maybeSingle();

      const sampleVerdict = bucket.verdicts[0];
      const sampleAction = sampleVerdict?.recommended_action ?? "monitor";
      const title = sampleVerdict?.ai_summary ?? `Cluster ${clusterKey}`;

      let incidentId: string;
      if (existing.data) {
        await sb.from("incidents").update({
          finding_count: existing.data.finding_count + bucket.findings.length,
          severity: bucket.severity,
          last_seen: new Date().toISOString(),
          ai_summary: title,
          recommended_action: sampleAction,
        }).eq("id", existing.data.id);
        incidentId = existing.data.id;
        incidentsUpdated += 1;
      } else {
        const { data: newInc } = await sb.from("incidents").insert({
          tenant_id: tenantIdResolved,
          cluster_key: clusterKey,
          title: title.slice(0, 120),
          category: clusterKey.split("-")[0],
          severity: bucket.severity,
          status: "open",
          finding_count: bucket.findings.length,
          ai_summary: title,
          recommended_action: sampleAction,
        }).select("id").single();
        incidentId = newInc!.id;
        incidentsCreated += 1;
      }

      // Tag findings with the incident_id
      await sb.from("findings").update({ incident_id: incidentId }).in("id", bucket.findings.map((f) => f.id));
    }

    return NextResponse.json({
      ok: true,
      processed: writesKept + writesDropped + writesReview + attribStats.suppressed + attribStats.elevated,
      kept: writesKept + attribStats.elevated,
      dropped: writesDropped + attribStats.suppressed,
      review: writesReview,
      skipped: writesSkipped,
      unmatched_by_id: unmatchedById,
      attribution: attribStats,
      incidents_created: incidentsCreated,
      incidents_updated: incidentsUpdated,
      tokens: { in: aiResp.tokens_in, out: aiResp.tokens_out },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
