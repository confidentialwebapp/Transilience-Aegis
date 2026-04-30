// v5: 8-resolver cascade for the Entity Attribution Skill.
//
// Each resolver returns either a definitive AttributionResult or null
// (meaning "I can't decide; pass to next resolver"). Resolvers 1–7 are
// deterministic + fast (target <50ms total). Resolver 8 calls Claude
// only if no deterministic resolver decided.

import { callClaude, extractJson } from "@/lib/anthropic";
import type {
  AttributionResult, FindingForAttribution, TrustEntity, TrustGraph,
} from "./types";
import { ExtractedIdentifiers, isSameOrSubdomain } from "./extract";

interface ResolverInput {
  finding: FindingForAttribution;
  ids: ExtractedIdentifiers;
  graph: TrustGraph;
}

type Resolver = (i: ResolverInput) => AttributionResult | null;

// ── Resolver 1: Authorized domain allowlist ─────────────────────────────
// If the finding's URL host matches a customer-owned domain (or subdomain),
// it's their own infrastructure → infrastructure_legitimate.
const r1_domain_allowlist: Resolver = ({ ids, graph }) => {
  const allowedDomains = new Set<string>();
  // Primary entity domains
  for (const d of graph.primary_entity.identifiers?.domains ?? []) allowedDomains.add(d.toLowerCase());
  // Authorized-domain entities
  for (const e of graph.entities) {
    if (e.kind === "authorized_domain") {
      for (const d of e.identifiers?.domains ?? []) allowedDomains.add(d.toLowerCase());
    }
  }

  for (const candidate of ids.domains) {
    for (const allowed of allowedDomains) {
      if (isSameOrSubdomain(candidate, allowed)) {
        return {
          decision: "infrastructure_legitimate",
          matched_entity: {
            entity_id: "ca_owned_domains",
            entity_kind: "authorized_domain",
            match_strength: 1.0,
          },
          reason: `Domain ${candidate} is customer-owned (matches ${allowed}).`,
          severity_modifier: -100,
          audit: { resolver: "deterministic", resolver_path: ["r1_domain_allowlist"], matched_identifiers: [candidate, allowed] },
        };
      }
    }
  }
  return null;
};

// ── Resolver 2: Corporate family (parent/sister/predecessor) ───────────
const r2_corporate_family: Resolver = ({ finding, ids, graph }) => {
  const corporateEnts = graph.entities.filter((e) => e.kind === "corporate_entity");
  for (const ent of corporateEnts) {
    const variants = ent.identifiers?.brand_variants ?? [];
    const domains = ent.identifiers?.domains ?? [];
    const matched: string[] = [];

    // Domain match
    for (const d of ids.domains) {
      for (const ed of domains) {
        if (isSameOrSubdomain(d, ed)) matched.push(d);
      }
    }
    // Brand variant match (case-insensitive substring on title/content/brand_mentions)
    const haystack = [finding.title, finding.content, ...(ids.brand_mentions ?? [])]
      .filter(Boolean).join("\n").toLowerCase();
    for (const v of variants) {
      if (haystack.includes(v.toLowerCase())) matched.push(v);
    }

    if (matched.length === 0) continue;

    // Decide based on subkind + status + temporal context
    if (ent.status === "active" && ent.subkind === "promoter_parent") {
      return mkDecision(ent, "sibling_out_of_scope", `Promoter-parent entity ${ent.display_name}; not the customer's primary scope.`,
        ent.severity_modifier ?? -40, 0.9, ["r2_corporate_family"], matched);
    }
    if (ent.status === "active" && ent.subkind === "wholly_owned_subsidiary") {
      return mkDecision(ent, "sibling_out_of_scope", `Subsidiary ${ent.display_name}; route per policy.`,
        ent.severity_modifier ?? -40, 0.9, ["r2_corporate_family"], matched);
    }

    if ((ent.status === "merged" || ent.status === "renamed") &&
        (ent.subkind === "merged_predecessor" || ent.subkind === "renamed_predecessor")) {
      // Temporal check
      const cutoff = ent.merger_effective_date ?? ent.rename_effective_date;
      const findingTs = finding.timestamp_source ? new Date(finding.timestamp_source) : null;
      const cutoffDate = cutoff ? new Date(cutoff) : null;

      // Active claim check — phrases that indicate the entity is being held out
      // as currently operational despite being merged/renamed.
      const haystack2 = haystack;
      const claimPhrases = ent.active_claim_phrases ?? [
        "apply now", "instant loan", "currently offering", "we offer", "open today",
      ];
      const activeClaim = claimPhrases.some((p) => haystack2.includes(p.toLowerCase()));

      if (cutoffDate && findingTs && findingTs < cutoffDate) {
        // Pre-cutoff: legitimate historical reference
        return mkDecision(ent, "historical_legitimate",
          `${ent.display_name} reference predates ${cutoff}; pre-merger/rename, legitimate historical context.`,
          ent.severity_modifier ?? -50, 0.95, ["r2_corporate_family", "temporal_pre_cutoff"], matched);
      }

      if (activeClaim) {
        // Post-cutoff + active claim → impersonation
        return mkDecision(ent, "impersonation_of_known_entity",
          `${ent.display_name} ${ent.status} into ${ent.merged_into ?? ent.renamed_to} on ${cutoff}, but the finding presents it as currently active. Treat as impersonation of predecessor.`,
          50, 0.9, ["r2_corporate_family", "active_claim_post_cutoff"], matched, "impersonation_of_predecessor");
      }

      // Post-cutoff, no active claim → probably legitimate historical mention
      return mkDecision(ent, "historical_legitimate",
        `${ent.display_name} reference appears to be historical (post-cutoff but no active-claim phrasing).`,
        ent.severity_modifier ?? -50, 0.8, ["r2_corporate_family", "temporal_post_cutoff_no_claim"], matched);
    }
  }
  return null;
};

// ── Resolver 3: Infrastructure attribution (CDN / cloud / registrar) ───
const r3_infrastructure: Resolver = ({ ids, graph }) => {
  const infraEnts = graph.entities.filter((e) => e.kind === "infrastructure_entity");
  for (const ent of infraEnts) {
    if (ent.treat_as !== "infrastructure_legitimate") continue;
    // Only "applies_to: customer_owned_domains_only" CDN entries should match
    // when host is on a customer-owned domain — but we already covered that
    // in R1. So infrastructure_legitimate from R3 fires for IP-only matches.
    const ipRanges = ent.identifiers?.ip_ranges ?? [];
    for (const ip of ids.ips) {
      for (const range of ipRanges) {
        if (ipInCidr(ip, range)) {
          return {
            decision: "infrastructure_legitimate",
            matched_entity: { entity_id: ent.entity_id, entity_kind: "infrastructure_entity", match_strength: 0.85 },
            reason: `IP ${ip} is in ${ent.display_name} range ${range}.`,
            severity_modifier: -80,
            audit: { resolver: "deterministic", resolver_path: ["r3_infrastructure"], matched_identifiers: [ip, range] },
          };
        }
      }
    }
  }
  return null;
};

// ── Resolver 4: Authorized partners ────────────────────────────────────
const r4_partners: Resolver = ({ finding, ids, graph }) => {
  const partnerEnts = graph.entities.filter((e) => e.kind === "partner_entity");
  for (const ent of partnerEnts) {
    const domains = ent.identifiers?.domains ?? [];
    for (const d of ids.domains) {
      for (const ed of domains) {
        if (isSameOrSubdomain(d, ed)) {
          return mkDecision(ent, "legitimate", `Authorized partner ${ent.display_name}.`,
            -60, 0.9, ["r4_partners"], [d]);
        }
      }
    }
  }
  return null;
};

// ── Resolver 5: People disambiguation ──────────────────────────────────
const r5_people: Resolver = ({ finding, ids, graph }) => {
  const peopleEnts = graph.entities.filter((e) => e.kind === "people_entity");
  for (const ent of peopleEnts) {
    const display = (ent.display_name ?? "").toLowerCase();
    const haystack = [finding.title, finding.content, ...(ids.person_names ?? [])]
      .filter(Boolean).join("\n").toLowerCase();
    if (!haystack.includes(display)) continue;

    // Verified handle match → legitimate
    const verified = ent.identifiers?.verified_handles ?? {};
    const urlHost = ids.url_host ?? "";
    const urlPath = (finding.url ?? "").toLowerCase();
    let handleMatch = false;
    for (const [platform, handle] of Object.entries(verified)) {
      if (handle === "TBD") continue;
      const platDomain = `${platform}.com`;
      if ((urlHost.includes(platform) || urlHost.includes(platDomain)) && urlPath.includes(handle.toLowerCase())) {
        handleMatch = true;
        break;
      }
    }
    if (handleMatch) {
      return mkDecision(ent, "legitimate", `${ent.display_name}'s verified handle.`,
        -100, 0.95, ["r5_people"], [display]);
    }
    // Name match but verified handle isn't found in URL — defer to AI fallback
    // so it can read the page context (could be impersonation OR a different
    // person with the same name).
    return null;
  }
  return null;
};

// ── Resolver 6: Generic term / homonym ─────────────────────────────────
const r6_generic_term: Resolver = ({ finding, ids, graph }) => {
  const collisionEnts = graph.entities.filter((e) =>
    e.kind === "name_collision_entity" || e.kind === "generic_term_entity",
  );
  for (const ent of collisionEnts) {
    const variants = ent.identifiers?.brand_variants ?? [];
    const domains = ent.identifiers?.domains ?? [];
    const haystack = [finding.title, finding.content].filter(Boolean).join("\n").toLowerCase();

    let matched: string[] = [];
    for (const v of variants) {
      if (haystack.includes(v.toLowerCase())) matched.push(v);
    }
    for (const d of ids.domains) {
      for (const ed of domains) {
        if (isSameOrSubdomain(d, ed)) matched.push(d);
      }
    }
    if (matched.length === 0) continue;

    // Generic-term entities flag ai_disambiguation_required → defer to R8
    if (ent.ai_disambiguation_required) return null;

    return mkDecision(ent, "name_collision_no_match",
      `Brand-name overlap with unrelated entity (${ent.display_name}).`,
      -100, 0.85, ["r6_generic_term"], matched);
  }
  return null;
};

// ── Resolver 7: Regulator / Gov ────────────────────────────────────────
const r7_regulator: Resolver = ({ finding, ids, graph }) => {
  const regEnts = graph.entities.filter((e) => e.kind === "regulator_entity");
  for (const ent of regEnts) {
    const domains = ent.identifiers?.domains ?? [];
    const variants = ent.identifiers?.brand_variants ?? [];
    const haystack = [finding.title, finding.content].filter(Boolean).join("\n").toLowerCase();
    let matched: string[] = [];
    for (const d of ids.domains) {
      for (const ed of domains) {
        if (isSameOrSubdomain(d, ed)) matched.push(d);
      }
    }
    for (const v of variants) {
      if (haystack.includes(v.toLowerCase())) matched.push(v);
    }
    if (matched.length === 0) continue;

    return mkDecision(ent, "legitimate",
      `Regulatory/government source (${ent.display_name}).`,
      -100, 0.95, ["r7_regulator"], matched);
  }
  return null;
};

// ── Resolver 8: AI fallback ────────────────────────────────────────────
const FALLBACK_PROMPT = `You are an entity attribution analyst.

INPUT: a finding + a brand-protection customer's Trust Graph (corporate
family, predecessors, name collisions, generic-term entities, regulators).

YOUR JOB: Decide which decision applies.

Allowed decisions:
- "legitimate" — finding refers to a known good entity in the Trust Graph
- "historical_legitimate" — refers to a renamed/merged predecessor in valid temporal context
- "infrastructure_legitimate" — owned/operated by customer's infra (CDN, cloud)
- "impersonation_of_known_entity" — claims to be a known entity but content contradicts (e.g. defunct entity offering active service)
- "sibling_out_of_scope" — related entity but not the customer's primary
- "name_collision_no_match" — brand-keyword overlaps with unrelated entity
- "needs_attribution_check" — uncertain after considering all options
- "no_match" — no attribution possible (likely standalone abuse, not a known-entity case)

Output EXACTLY this JSON object (no prose, no fences):
{
  "decision": "<one of the above>",
  "matched_entity_id": "<id from Trust Graph or null>",
  "reason": "<one short sentence>",
  "match_strength": 0..1
}

Be conservative: prefer "no_match" over guessing. The downstream pipeline will run separate fraud rules — your job is only to attribute, not classify.`;

const r8_ai_fallback: Resolver = () => null; // sync stub; real one is async below

async function runAiFallback(input: ResolverInput): Promise<AttributionResult> {
  const { finding, ids, graph } = input;
  // Build a compact view of the Trust Graph for the AI
  const compact = {
    primary_entity: {
      legal_name: graph.primary_entity.legal_name,
      brand_variants: graph.primary_entity.identifiers?.brand_variants,
      domains: graph.primary_entity.identifiers?.domains,
    },
    entities: graph.entities.map((e) => ({
      entity_id: e.entity_id,
      kind: e.kind,
      subkind: e.subkind,
      display_name: e.display_name,
      status: e.status,
      treat_as: e.treat_as,
      brand_variants: e.identifiers?.brand_variants,
      note_for_ai: e.note_for_ai,
    })),
  };
  const userPayload = {
    trust_graph: compact,
    finding: {
      url: finding.url,
      title: finding.title,
      content: finding.content?.slice(0, 1200),
      domain: ids.domains.slice(0, 4),
      brand_mentions: ids.brand_mentions,
      person_names: ids.person_names,
      timestamp_source: finding.timestamp_source,
    },
  };

  const ai = await callClaude({ system: FALLBACK_PROMPT, user: userPayload, maxTokens: 400 });
  const parsed = extractJson<{
    decision: string;
    matched_entity_id?: string | null;
    reason: string;
    match_strength?: number;
  }>(ai.text);

  if (!parsed || !parsed.decision) {
    return {
      decision: "needs_attribution_check",
      matched_entity: null,
      reason: "AI fallback returned malformed output; flagging for human review.",
      severity_modifier: 0,
      audit: { resolver: "ai_fallback", resolver_path: ["r8_ai_fallback"], matched_identifiers: [],
               ai_tokens_in: ai.tokens_in, ai_tokens_out: ai.tokens_out },
    };
  }

  const validDecisions = new Set([
    "legitimate", "historical_legitimate", "infrastructure_legitimate",
    "impersonation_of_known_entity", "sibling_out_of_scope",
    "name_collision_no_match", "needs_attribution_check", "no_match",
  ]);
  const decision = (validDecisions.has(parsed.decision) ? parsed.decision : "needs_attribution_check") as AttributionResult["decision"];

  const ent = parsed.matched_entity_id ? graph.entities.find((e) => e.entity_id === parsed.matched_entity_id) : null;

  return {
    decision,
    matched_entity: ent ? {
      entity_id: ent.entity_id,
      entity_kind: ent.kind,
      match_strength: parsed.match_strength ?? 0.7,
    } : null,
    reason: parsed.reason,
    severity_modifier: ent?.severity_modifier ?? 0,
    audit: {
      resolver: "ai_fallback",
      resolver_path: ["r8_ai_fallback"],
      matched_identifiers: parsed.matched_entity_id ? [parsed.matched_entity_id] : [],
      ai_tokens_in: ai.tokens_in,
      ai_tokens_out: ai.tokens_out,
    },
  };
}

// ── Main cascade orchestrator ──────────────────────────────────────────
const RESOLVERS: { name: string; fn: Resolver }[] = [
  { name: "r1_domain_allowlist", fn: r1_domain_allowlist },
  { name: "r2_corporate_family", fn: r2_corporate_family },
  { name: "r3_infrastructure", fn: r3_infrastructure },
  { name: "r4_partners", fn: r4_partners },
  { name: "r5_people", fn: r5_people },
  { name: "r6_generic_term", fn: r6_generic_term },
  { name: "r7_regulator", fn: r7_regulator },
  { name: "r8_ai_fallback", fn: r8_ai_fallback },
];

export async function runResolverCascade(
  input: ResolverInput,
  options: { aiFallbackEnabled: boolean },
): Promise<AttributionResult> {
  const path: string[] = [];
  for (const r of RESOLVERS.slice(0, 7)) {  // Resolvers 1–7 are deterministic
    path.push(r.name);
    const out = r.fn(input);
    if (out) {
      out.audit.resolver_path = path;
      return out;
    }
  }
  // R8 — only run if AI fallback is enabled in policy
  if (options.aiFallbackEnabled) {
    path.push("r8_ai_fallback");
    const out = await runAiFallback(input);
    out.audit.resolver_path = path;
    return out;
  }
  return {
    decision: "no_match",
    matched_entity: null,
    reason: "No deterministic resolver matched and AI fallback disabled.",
    severity_modifier: 0,
    audit: { resolver: "deterministic", resolver_path: path, matched_identifiers: [] },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function mkDecision(
  ent: TrustEntity,
  decision: AttributionResult["decision"],
  reason: string,
  severityModifier: number,
  matchStrength: number,
  resolverPath: string[],
  matched: string[],
  newFraudPattern?: string,
): AttributionResult {
  return {
    decision,
    matched_entity: { entity_id: ent.entity_id, entity_kind: ent.kind, relationship: ent.subkind, match_strength: matchStrength },
    reason,
    severity_modifier: severityModifier,
    new_fraud_pattern: newFraudPattern ?? null,
    audit: { resolver: "deterministic", resolver_path: resolverPath, matched_identifiers: matched },
  };
}

/** Quick CIDR membership check for IPv4. Good enough for common cases. */
function ipInCidr(ip: string, cidr: string): boolean {
  const [base, prefix] = cidr.split("/");
  if (!prefix) return ip === base;
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base);
  if (ipInt === -1 || baseInt === -1) return false;
  const mask = ~((1 << (32 - parseInt(prefix, 10))) - 1) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipToInt(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
