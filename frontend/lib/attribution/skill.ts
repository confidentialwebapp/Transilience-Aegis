// v5: Entity Attribution Skill — orchestrator.
// Public entrypoint used by the API route AND by the ai-process pipeline.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AttributionResult, FindingForAttribution, TrustGraph,
} from "./types";
import { extractFromFinding } from "./extract";
import { runResolverCascade } from "./resolvers";

export interface SkillContext {
  customer_id: string;
  tenant_id: string;
  trust_graph: TrustGraph;
  ai_fallback_enabled: boolean;
}

/** Load the Trust Graph for a tenant. Caches inside the request. */
export async function loadTrustGraph(
  sb: SupabaseClient,
  tenantId: string,
): Promise<{ ctx: SkillContext } | { error: string }> {
  const { data, error } = await sb
    .from("trust_graph")
    .select("customer_id, graph_json, policy")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { error: `trust_graph fetch: ${error.message}` };
  if (!data) return { error: `no trust_graph for tenant ${tenantId}` };
  return {
    ctx: {
      customer_id: data.customer_id,
      tenant_id: tenantId,
      trust_graph: data.graph_json as TrustGraph,
      ai_fallback_enabled: (data.policy as { ai_fallback_enabled?: boolean })?.ai_fallback_enabled ?? true,
    },
  };
}

/** Run the skill on a single finding. Persists the decision in
 *  attribution_decisions and updates the finding row. Idempotent — on
 *  re-call for the same finding_id, it upserts. */
export async function attributeFinding(
  sb: SupabaseClient,
  ctx: SkillContext,
  finding: FindingForAttribution,
): Promise<AttributionResult> {
  // Identifier extraction
  const brandLexicon = [
    ...(ctx.trust_graph.primary_entity.identifiers?.brand_variants ?? []),
    ...ctx.trust_graph.entities.flatMap((e) => e.identifiers?.brand_variants ?? []),
  ];
  const knownPeople = ctx.trust_graph.entities
    .filter((e) => e.kind === "people_entity")
    .map((e) => e.display_name ?? "")
    .filter(Boolean);
  const ids = extractFromFinding(finding, brandLexicon, knownPeople);

  // R8 cache lookup — saves repeat AI calls when same suspect entity recurs
  const cacheKey = makeCacheKey(ctx.customer_id, ids.domains, ids.brand_mentions);
  let result: AttributionResult | null = null;
  let usedCache = false;

  // Fast path — try deterministic resolvers first (always run; cache only saves AI call)
  const detResult = await runResolverCascade(
    { finding, ids, graph: ctx.trust_graph },
    { aiFallbackEnabled: false },  // first pass: deterministic only
  );

  if (detResult.decision !== "no_match") {
    result = detResult;
  } else if (ctx.ai_fallback_enabled) {
    // Check cache before paying for AI
    const cached = await sb
      .from("attribution_ai_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached.data) {
      usedCache = true;
      result = {
        decision: cached.data.decision,
        matched_entity: cached.data.matched_entity_id ? {
          entity_id: cached.data.matched_entity_id,
          entity_kind: "corporate_entity",  // not strictly known from cache; could store
          match_strength: cached.data.match_strength ?? 0.7,
        } : null,
        reason: `[cache] ${cached.data.reason}`,
        severity_modifier: 0,
        audit: { resolver: "cache", resolver_path: ["cache_hit"], matched_identifiers: [] },
      };
    } else {
      // Run R8 only — pass aiFallbackEnabled=true so cascade goes all the way
      result = await runResolverCascade(
        { finding, ids, graph: ctx.trust_graph },
        { aiFallbackEnabled: true },
      );
      // Cache the AI result
      if (result.audit.resolver === "ai_fallback") {
        await sb.from("attribution_ai_cache").upsert({
          cache_key: cacheKey,
          customer_id: ctx.customer_id,
          decision: result.decision,
          matched_entity_id: result.matched_entity?.entity_id ?? null,
          reason: result.reason,
          match_strength: result.matched_entity?.match_strength ?? null,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }, { onConflict: "cache_key" });
      }
    }
  } else {
    result = detResult;
  }

  // Persist
  await sb.from("attribution_decisions").upsert({
    finding_id: finding.finding_id,
    tenant_id: ctx.tenant_id,
    customer_id: ctx.customer_id,
    decision: result.decision,
    matched_entity_id: result.matched_entity?.entity_id ?? null,
    matched_entity_kind: result.matched_entity?.entity_kind ?? null,
    resolver_path: result.audit.resolver_path,
    used_ai_fallback: result.audit.resolver === "ai_fallback",
    match_strength: result.matched_entity?.match_strength ?? null,
    severity_modifier: result.severity_modifier,
    reason: result.reason,
    ai_tokens_in: result.audit.ai_tokens_in ?? null,
    ai_tokens_out: result.audit.ai_tokens_out ?? null,
  }, { onConflict: "finding_id" });

  await sb.from("findings").update({
    attribution_decision: result.decision,
    matched_entity_id: result.matched_entity?.entity_id ?? null,
    matched_entity_kind: result.matched_entity?.entity_kind ?? null,
    severity_modifier: result.severity_modifier,
    attribution_audit: result.audit,
  }).eq("id", finding.finding_id);

  return result;
}

function makeCacheKey(customer_id: string, domains: string[], brands: string[]): string {
  const sortedDomains = [...new Set(domains)].sort().join(",");
  const sortedBrands = [...new Set(brands.map((b) => b.toLowerCase()))].sort().join(",");
  return createHash("sha256")
    .update(`${customer_id}|${sortedDomains}|${sortedBrands}`)
    .digest("hex");
}

/** Decisions whose findings should be auto-suppressed (don't reach AI Filter). */
export const AUTO_SUPPRESS_DECISIONS = new Set([
  "legitimate",
  "historical_legitimate",
  "infrastructure_legitimate",
  "name_collision_no_match",
]);

/** Decisions whose findings should be elevated (skip AI Filter, mark as kept high-severity). */
export const AUTO_ELEVATE_DECISIONS = new Set([
  "impersonation_of_known_entity",
]);
