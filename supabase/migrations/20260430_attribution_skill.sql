-- v5: Entity Attribution Skill + Trust Graph (per "TAI AEGIS Brand Monitoring v5")
--
-- Adds a per-customer Trust Graph that the Attribution Skill consults to
-- resolve any finding's identifiers (domain/IP/brand/person/handle) against
-- a known-entity ledger BEFORE the AI false-positive filter runs.
--
-- 8 entity kinds: corporate, infrastructure, partner, people,
-- name_collision, generic_term, regulator, authorized_domain.
-- 8 cascading resolvers map a finding to a decision: legitimate /
-- historical_legitimate / infrastructure_legitimate / sibling_out_of_scope /
-- impersonation_of_known_entity / name_collision_no_match /
-- needs_attribution_check / no_match.

-- ── Trust Graph (per-customer) ────────────────────────────────────────
create table if not exists trust_graph (
  customer_id        text primary key,
  tenant_id          uuid references tenants(id) on delete cascade,
  graph_json         jsonb not null,
  version            text not null,
  revision           text,
  last_reviewed_at   timestamptz,
  last_reviewed_by   text,
  next_review_due    date,
  policy             jsonb default '{}'::jsonb,  -- ai_fallback_enabled, audit_all_decisions, etc.
  updated_at         timestamptz default now(),
  created_at         timestamptz default now()
);
create index if not exists idx_trust_graph_tenant on trust_graph(tenant_id);

-- ── Attribution decisions (audit ledger; one row per skill invocation) ──
create table if not exists attribution_decisions (
  id                  uuid primary key default gen_random_uuid(),
  finding_id          uuid references findings(id) on delete cascade,
  tenant_id           uuid references tenants(id) on delete cascade,
  customer_id         text,
  decision            text not null check (decision in (
    'legitimate', 'historical_legitimate', 'infrastructure_legitimate',
    'impersonation_of_known_entity', 'sibling_out_of_scope',
    'name_collision_no_match', 'needs_attribution_check', 'no_match'
  )),
  matched_entity_id   text,
  matched_entity_kind text,
  resolver_path       text[],
  used_ai_fallback    boolean default false,
  match_strength      numeric(3,2),
  severity_modifier   int default 0,
  reason              text,
  ai_tokens_in        int,
  ai_tokens_out       int,
  decided_at          timestamptz default now()
);
create index if not exists idx_attrib_finding on attribution_decisions(finding_id);
create index if not exists idx_attrib_tenant on attribution_decisions(tenant_id);
create index if not exists idx_attrib_decision on attribution_decisions(decision);
create index if not exists idx_attrib_entity on attribution_decisions(matched_entity_id);
create unique index if not exists ux_attrib_finding on attribution_decisions(finding_id);

-- ── Analyst overrides ──────────────────────────────────────────────────
create table if not exists attribution_overrides (
  id                  uuid primary key default gen_random_uuid(),
  finding_id          uuid references findings(id) on delete cascade,
  attribution_id      uuid references attribution_decisions(id) on delete cascade,
  override_decision   text not null,
  override_reason     text,
  decided_by          text not null,
  decided_at          timestamptz default now()
);
create index if not exists idx_attrib_override_finding on attribution_overrides(finding_id);

-- ── Resolver 8 cache (skip repeat AI calls for same suspect entity) ────
-- 24h TTL keyed by domain + brand_mention hash. Saves ~70% LLM cost on
-- repeat-finding scenarios (typosquat campaigns, recurring scam clusters).
create table if not exists attribution_ai_cache (
  cache_key           text primary key,         -- sha256(customer_id|domain|sorted_brand_mentions)
  customer_id         text not null,
  decision            text not null,
  matched_entity_id   text,
  reason              text,
  match_strength      numeric(3,2),
  cached_at           timestamptz default now(),
  expires_at          timestamptz default now() + interval '24 hours'
);
create index if not exists idx_attrib_cache_expires on attribution_ai_cache(expires_at);

-- ── Findings extension: attribution outcome columns ────────────────────
alter table findings add column if not exists attribution_decision  text;
alter table findings add column if not exists matched_entity_id     text;
alter table findings add column if not exists matched_entity_kind   text;
alter table findings add column if not exists severity_modifier     int default 0;
alter table findings add column if not exists attribution_audit     jsonb;
create index if not exists idx_findings_attribution on findings(attribution_decision);

-- ── Realtime publication for the new live tables ───────────────────────
do $$
begin alter publication supabase_realtime add table trust_graph;
exception when duplicate_object then null; end $$;
do $$
begin alter publication supabase_realtime add table attribution_decisions;
exception when duplicate_object then null; end $$;
do $$
begin alter publication supabase_realtime add table attribution_overrides;
exception when duplicate_object then null; end $$;

-- ── RLS: tenants see their own decisions; service role bypasses ────────
alter table trust_graph              enable row level security;
alter table attribution_decisions    enable row level security;
alter table attribution_overrides    enable row level security;
alter table attribution_ai_cache     enable row level security;

-- Allow tenant members to read their own trust graph + decisions.
-- Uses the same auth_tenant_id() / is_admin() helpers as the existing
-- findings RLS policies for consistency.
do $$ begin
  create policy trust_graph_tenant_read on trust_graph
    for select using (is_admin() or tenant_id = auth_tenant_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy attrib_decisions_tenant_read on attribution_decisions
    for select using (is_admin() or tenant_id = auth_tenant_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy attrib_overrides_tenant_read on attribution_overrides
    for select using (
      is_admin() or finding_id in (select id from findings where tenant_id = auth_tenant_id())
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy attrib_cache_admin on attribution_ai_cache
    for select using (is_admin());
exception when duplicate_object then null; end $$;
