// v5: Entity Attribution Skill — public API.
// Two modes:
//   POST /api/skills/attribution    body: {tenant_id, finding_ids: [...]}
//     → Run skill on a batch of existing findings (≤200).
//   POST /api/skills/attribution    body: {tenant_id, finding: {...}}
//     → Run skill on an ad-hoc unsaved finding (returns result, no persistence).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attributeFinding, loadTrustGraph } from "@/lib/attribution/skill";
import type { FindingForAttribution } from "@/lib/attribution/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      finding_ids?: string[];
      finding?: FindingForAttribution;
      max_findings?: number;
    };
    if (!body.tenant_id) {
      return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const loaded = await loadTrustGraph(sb, body.tenant_id);
    if ("error" in loaded) {
      return NextResponse.json({ ok: false, error: loaded.error }, { status: 404 });
    }
    const ctx = loaded.ctx;

    // Ad-hoc mode: dry-run skill without persistence
    if (body.finding) {
      const result = await attributeFinding(sb, ctx, body.finding);
      return NextResponse.json({ ok: true, result });
    }

    // Batch mode: pull findings + attribute
    let findingsQuery = sb.from("findings")
      .select("id, feature_id, source, kind, url_or_value, evidence, language_detected, timestamp_source")
      .eq("tenant_id", body.tenant_id);
    if (body.finding_ids && body.finding_ids.length > 0) {
      findingsQuery = findingsQuery.in("id", body.finding_ids);
    } else {
      // Default: process all findings without an attribution_decision yet
      findingsQuery = findingsQuery.is("attribution_decision", null).limit(Math.min(body.max_findings ?? 100, 200));
    }
    const { data: rows, error } = await findingsQuery;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    interface Row {
      id: string; feature_id: string | null; source: string | null;
      kind: string | null; url_or_value: string | null;
      evidence: { content?: string; title?: string; raw?: string; description?: string } | null;
      language_detected: string | null; timestamp_source: string | null;
    }

    const counts: Record<string, number> = {};
    let aiFallbackUsed = 0;
    let cacheHits = 0;
    let persistErrors = 0;
    const errSamples: string[] = [];
    const results: { finding_id: string; decision: string; matched_entity?: string; severity_modifier: number }[] = [];

    // Parallelize with concurrency cap so AI fallback calls overlap. With ~12
    // AI calls × 2-3s each, sequential exceeds Vercel's 60s — pools of 6 keep
    // the whole batch within ~10-12s comfortably.
    const findingsList = (rows ?? []) as Row[];
    const CONCURRENCY = 6;
    for (let start = 0; start < findingsList.length; start += CONCURRENCY) {
      const chunk = findingsList.slice(start, start + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map((r) => {
        const finding: FindingForAttribution = {
          finding_id: r.id,
          feature_id: r.feature_id,
          source: r.source,
          url: r.url_or_value,
          domain: r.url_or_value && !r.url_or_value.startsWith("http") ? r.url_or_value : null,
          title: r.evidence?.title ?? null,
          content: r.evidence?.content ?? r.evidence?.description ?? r.evidence?.raw ?? null,
          timestamp_source: r.timestamp_source,
          language_detected: r.language_detected,
        };
        return attributeFinding(sb, ctx, finding);
      }));
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        const r = chunk[i];
        if (s.status === "rejected") {
          persistErrors += 1;
          if (errSamples.length < 3) errSamples.push(`reject: ${(s.reason as Error)?.message?.slice(0, 200) ?? "unknown"}`);
          continue;
        }
        const out = s.value as typeof s.value & { _persist_error?: string };
        counts[out.decision] = (counts[out.decision] ?? 0) + 1;
        if (out.audit.resolver === "ai_fallback") aiFallbackUsed += 1;
        if (out.audit.resolver === "cache") cacheHits += 1;
        if (out._persist_error) {
          persistErrors += 1;
          if (errSamples.length < 3) errSamples.push(out._persist_error);
        }
        results.push({ finding_id: r.id, decision: out.decision, matched_entity: out.matched_entity?.entity_id, severity_modifier: out.severity_modifier });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      counts,
      ai_fallback_used: aiFallbackUsed,
      cache_hits: cacheHits,
      persist_errors: persistErrors,
      persist_error_samples: errSamples,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
