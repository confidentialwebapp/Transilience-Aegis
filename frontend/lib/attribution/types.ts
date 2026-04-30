// v5: Entity Attribution Skill — shared types.
// Decisions, entities, finding shape, audit format.

export type AttributionDecision =
  | "legitimate"
  | "historical_legitimate"
  | "infrastructure_legitimate"
  | "impersonation_of_known_entity"
  | "sibling_out_of_scope"
  | "name_collision_no_match"
  | "needs_attribution_check"
  | "no_match";

export type EntityKind =
  | "corporate_entity"
  | "infrastructure_entity"
  | "partner_entity"
  | "people_entity"
  | "name_collision_entity"
  | "generic_term_entity"
  | "regulator_entity"
  | "authorized_domain";

export interface TrustEntity {
  entity_id: string;
  kind: EntityKind;
  subkind?: string;
  display_name?: string;
  legal_name?: string;
  status?: string;
  country?: string;
  identifiers?: {
    domains?: string[];
    brand_variants?: string[];
    asns?: number[];
    ip_ranges?: string[];
    registrar_iana_ids?: number[];
    mx_patterns?: string[];
    verified_handles?: Record<string, string>;
    official_emails?: string[];
  };
  treat_as?: AttributionDecision | "neutral";
  severity_modifier?: number;
  applies_to?: string[];
  note?: string;
  note_for_ai?: string;
  // Historical entity fields
  merged_into?: string;
  merger_effective_date?: string;
  renamed_to?: string;
  rename_effective_date?: string;
  post_merger_treatment?: "elevate_if_active_claim" | "always_legitimate";
  post_rename_treatment?: "elevate_if_active_claim" | "always_legitimate";
  active_claim_phrases?: string[];
  ai_disambiguation_required?: boolean;
}

export interface TrustGraph {
  primary_entity: TrustEntity;
  entities: TrustEntity[];
}

export interface FindingForAttribution {
  finding_id: string;
  feature_id?: string | null;
  source?: string | null;
  url?: string | null;
  domain?: string | null;
  ip?: string | null;
  brand_mentions?: string[];
  person_names?: string[];
  content?: string | null;
  title?: string | null;
  timestamp_source?: string | null;
  language_detected?: string | null;
}

export interface AttributionResult {
  decision: AttributionDecision;
  matched_entity: {
    entity_id: string;
    entity_kind: EntityKind;
    relationship?: string;
    match_strength: number;
  } | null;
  reason: string;
  severity_modifier: number;
  new_fraud_pattern?: string | null;
  audit: {
    resolver: "deterministic" | "ai_fallback" | "cache";
    resolver_path: string[];
    matched_identifiers: string[];
    ai_tokens_in?: number;
    ai_tokens_out?: number;
  };
}
