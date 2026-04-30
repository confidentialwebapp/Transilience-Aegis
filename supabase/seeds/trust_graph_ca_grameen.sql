-- Seed Trust Graph for CreditAccess Grameen Limited (per v5 spec).
-- Sourced from the customer's own corporate disclosures + RBI / SEBI / NSE
-- public records. Reviewed by legal/compliance during onboarding.

insert into trust_graph (customer_id, tenant_id, version, revision,
  last_reviewed_at, last_reviewed_by, next_review_due, policy, graph_json)
values (
  'creditaccessgrameen',
  '23610954-5fd0-482f-8eb0-11edce1f5c58',
  '2026-04-30',
  'quarterly_2026_q2',
  now(),
  'system_seed_v5',
  (now() + interval '90 days')::date,
  jsonb_build_object(
    'default_decision_for_no_match', 'pass_through',
    'ai_fallback_enabled', true,
    'ai_fallback_threshold', 'uncertain_after_deterministic',
    'audit_all_decisions', true,
    'analyst_override_allowed', true
  ),
  $json$
{
  "primary_entity": {
    "entity_id": "ca_grameen",
    "kind": "corporate_entity",
    "legal_name": "CreditAccess Grameen Limited",
    "cin": "L51216KA1991PLC053425",
    "regulator": "RBI",
    "country": "IN",
    "status": "active",
    "identifiers": {
      "domains": ["creditaccessgrameen.in", "grameenkoota.in"],
      "brand_variants": ["CreditAccess Grameen", "CA Grameen", "CAGL", "Credit Access Grameen"]
    }
  },
  "entities": [
    {
      "entity_id": "ca_india_bv",
      "kind": "corporate_entity",
      "subkind": "promoter_parent",
      "display_name": "CreditAccess India B.V.",
      "country": "NL",
      "status": "active",
      "identifiers": {
        "brand_variants": ["CreditAccess India", "CreditAccess India BV", "CA India BV"],
        "domains": ["creditaccessasia.com"]
      },
      "treat_as": "sibling_out_of_scope",
      "severity_modifier": -40
    },
    {
      "entity_id": "mmfl",
      "kind": "corporate_entity",
      "subkind": "merged_predecessor",
      "display_name": "Madura Micro Finance Limited",
      "country": "IN",
      "status": "merged",
      "merged_into": "ca_grameen",
      "merger_effective_date": "2023-02-15",
      "identifiers": {
        "brand_variants": ["MMFL", "Madura Micro Finance", "Madura Microfinance", "Madura Micro"]
      },
      "treat_as": "historical_legitimate",
      "post_merger_treatment": "elevate_if_active_claim",
      "severity_modifier": -50,
      "active_claim_phrases": ["apply now", "instant loan", "disburse", "currently offering", "open today", "new branch", "we offer", "loans available"]
    },
    {
      "entity_id": "grameen_koota",
      "kind": "corporate_entity",
      "subkind": "renamed_predecessor",
      "display_name": "Grameen Koota Financial Services Private Limited",
      "country": "IN",
      "status": "renamed",
      "renamed_to": "ca_grameen",
      "rename_effective_date": "2018-01-01",
      "identifiers": {
        "brand_variants": ["Grameen Koota", "Grameen Financial Services", "Grameen Koota Financial"]
      },
      "treat_as": "historical_legitimate",
      "post_rename_treatment": "elevate_if_active_claim",
      "severity_modifier": -50
    },
    {
      "entity_id": "caif",
      "kind": "corporate_entity",
      "subkind": "wholly_owned_subsidiary",
      "display_name": "CreditAccess India Foundation",
      "country": "IN",
      "status": "active",
      "incorporated_date": "2021-05-29",
      "identifiers": {
        "brand_variants": ["CAIF", "CA India Foundation", "CreditAccess Foundation"]
      },
      "treat_as": "sibling_out_of_scope",
      "severity_modifier": -40
    },
    {
      "entity_id": "cloudflare_cdn",
      "kind": "infrastructure_entity",
      "subkind": "cdn_provider",
      "display_name": "Cloudflare",
      "identifiers": {
        "asns": [13335, 209242],
        "ip_ranges": ["104.16.0.0/12", "172.64.0.0/13", "162.158.0.0/15", "188.114.96.0/20", "190.93.240.0/20"]
      },
      "treat_as": "infrastructure_legitimate",
      "applies_to": ["customer_owned_domains_only"]
    },
    {
      "entity_id": "aws_cloud",
      "kind": "infrastructure_entity",
      "subkind": "cloud_provider",
      "display_name": "Amazon Web Services",
      "identifiers": { "asns": [16509, 14618, 8987, 39111] },
      "treat_as": "neutral",
      "note": "Hosting on AWS alone is not attribution; many phishing sites also use AWS."
    },
    {
      "entity_id": "godaddy_registrar",
      "kind": "infrastructure_entity",
      "subkind": "domain_registrar",
      "display_name": "GoDaddy",
      "identifiers": { "registrar_iana_ids": [146] },
      "treat_as": "neutral",
      "note": "Registrar alone is not attribution."
    },
    {
      "entity_id": "google_workspace",
      "kind": "infrastructure_entity",
      "subkind": "email_provider",
      "display_name": "Google Workspace",
      "identifiers": { "mx_patterns": ["aspmx.l.google.com", "googlemail.com"] },
      "treat_as": "neutral"
    },
    {
      "entity_id": "rbi",
      "kind": "regulator_entity",
      "display_name": "Reserve Bank of India",
      "identifiers": {
        "domains": ["rbi.org.in", "rbi.gov.in"],
        "brand_variants": ["RBI", "Reserve Bank of India"]
      },
      "treat_as": "legitimate",
      "applies_to": ["all_findings"]
    },
    {
      "entity_id": "sebi",
      "kind": "regulator_entity",
      "display_name": "Securities and Exchange Board of India",
      "identifiers": { "domains": ["sebi.gov.in"], "brand_variants": ["SEBI"] },
      "treat_as": "legitimate"
    },
    {
      "entity_id": "mca",
      "kind": "regulator_entity",
      "display_name": "Ministry of Corporate Affairs",
      "identifiers": { "domains": ["mca.gov.in"], "brand_variants": ["MCA", "Ministry of Corporate Affairs"] },
      "treat_as": "legitimate"
    },
    {
      "entity_id": "nse",
      "kind": "regulator_entity",
      "subkind": "exchange",
      "display_name": "National Stock Exchange",
      "identifiers": { "domains": ["nseindia.com"], "brand_variants": ["NSE", "National Stock Exchange"] },
      "treat_as": "legitimate"
    },
    {
      "entity_id": "bse",
      "kind": "regulator_entity",
      "subkind": "exchange",
      "display_name": "Bombay Stock Exchange",
      "identifiers": { "domains": ["bseindia.com"], "brand_variants": ["BSE", "Bombay Stock Exchange"] },
      "treat_as": "legitimate"
    },
    {
      "entity_id": "exec_ganesh",
      "kind": "people_entity",
      "subkind": "executive",
      "display_name": "Ganesh Narayanan",
      "title": "MD & CEO",
      "identifiers": {
        "verified_handles": { "linkedin": "ganesh-narayanan-cagl" }
      },
      "treat_as": "legitimate"
    },
    {
      "entity_id": "name_collision_madura",
      "kind": "name_collision_entity",
      "display_name": "Other Madura companies (Coats, Garments, Fashion)",
      "identifiers": {
        "brand_variants": ["Madura Coats", "Madura Garments", "Madura Fashion", "Madura Microfinance Foundation"],
        "domains": ["maduragarments.com", "maduracoats.com"]
      },
      "treat_as": "name_collision_no_match",
      "note": "Different industry, different ownership; brand-name overlap only."
    },
    {
      "entity_id": "generic_grameen",
      "kind": "generic_term_entity",
      "display_name": "Grameen as generic term",
      "note": "'Grameen' means 'rural' in Hindi/Bengali; widely used by other rural-focused entities including Grameen Bank Bangladesh, Grameen Foundation USA, Grameen India, Grameen Capital.",
      "identifiers": {
        "brand_variants": ["Grameen Bank", "Grameen Foundation", "Grameen Capital India", "Grameen Capital", "Grameen Trust", "Grameen America", "Yunus", "Muhammad Yunus"]
      },
      "treat_as": "name_collision_no_match",
      "ai_disambiguation_required": true,
      "note_for_ai": "If the finding refers to Grameen Bank Bangladesh (founded by Muhammad Yunus) or Grameen Foundation USA, treat as name collision, NOT impersonation of CA Grameen."
    },
    {
      "entity_id": "ca_owned_domains",
      "kind": "authorized_domain",
      "display_name": "CA Grameen owned domains",
      "identifiers": {
        "domains": [
          "creditaccessgrameen.in",
          "creditaccessgrameen.com",
          "grameenkoota.in",
          "grameenkoota.com",
          "creditaccess.in"
        ]
      },
      "treat_as": "infrastructure_legitimate",
      "note": "Customer-owned. Subdomains of these are authorized."
    }
  ]
}
$json$::jsonb
)
on conflict (customer_id) do update
  set graph_json = excluded.graph_json,
      version = excluded.version,
      revision = excluded.revision,
      last_reviewed_at = excluded.last_reviewed_at,
      last_reviewed_by = excluded.last_reviewed_by,
      next_review_due = excluded.next_review_due,
      policy = excluded.policy,
      updated_at = now();
