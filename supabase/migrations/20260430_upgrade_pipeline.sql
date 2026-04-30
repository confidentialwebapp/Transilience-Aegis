-- Upgrade pipeline (per "TAI AEGIS Upgrade Architecture for Brand Monitoring"):
-- Stage 2 AI Enricher, Stage 3 AI Planner, Stage 4 sync gate, Stage 6 AI Filter,
-- Stage 7 dashboard prep + incident grouping.

-- ── Stage 2: enrichment_runs (AI-driven asset expansion) ──────────────
create table if not exists enrichment_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,
  triggered_by    uuid,
  status          text default 'running' check (status in ('running','completed','failed')),
  raw_bundle      jsonb,        -- snapshot of customer-provided assets
  enriched_bundle jsonb,        -- AI Enricher output (aliases, related entities, lexicons)
  ai_model        text,
  ai_tokens_in    int,
  ai_tokens_out   int,
  error_message   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);
create index if not exists idx_enrichment_runs_tenant on enrichment_runs(tenant_id, started_at desc);

-- ── Stage 3: planner_runs (Enriched bundle → scan plan) ──────────────
create table if not exists planner_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,
  enrichment_run_id uuid references enrichment_runs(id) on delete set null,
  triggered_by    uuid,
  status          text default 'running' check (status in ('running','completed','failed')),
  scan_plan       jsonb,        -- ordered list of feature_ids + apify_task_ids + kali_tools + sequencing rules
  rationale       text,         -- AI's plain-text justification
  ai_model        text,
  ai_tokens_in    int,
  ai_tokens_out   int,
  error_message   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);
create index if not exists idx_planner_runs_tenant on planner_runs(tenant_id, started_at desc);

-- ── Stage 4: composite_scan_arms (sync gate ledger) ──────────────────
-- One row per (scan_run, arm) — when both arms have status='completed',
-- n8n moves to ingestion.
create table if not exists composite_scan_arms (
  id            uuid primary key default gen_random_uuid(),
  scan_run_id   uuid references scan_runs(id) on delete cascade,
  arm           text not null check (arm in ('apify','kali','external_api')),
  status        text default 'running' check (status in ('running','completed','failed','timeout')),
  output_ref    text,          -- apify dataset id / kali stdout summary URL / etc.
  output_summary jsonb,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  error_message text
);
create unique index if not exists ux_composite_arms on composite_scan_arms(scan_run_id, arm);

-- ── Stage 7: incidents (grouped findings) ────────────────────────────
-- An incident is a cluster of findings that point to the same actor, ASN,
-- or campaign. The AI Dashboard prep step groups findings into incidents.
create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  title         text,
  category      text,          -- 'phishing_campaign', 'fake_app_cluster', 'recovery_scam', etc.
  severity      text check (severity in ('Critical','Substantial','Moderate','Low')),
  status        text default 'open' check (status in ('open','triaged','closed','reopened')),
  asn           int,
  cluster_key   text,           -- the heuristic that grouped these (e.g. "asn:13335", "host:example.com", "actor:LockBit")
  finding_count int default 0,
  ai_summary    text,           -- one-line human description
  recommended_action text,
  first_seen    timestamptz default now(),
  last_seen     timestamptz default now(),
  closed_at     timestamptz
);
create index if not exists idx_incidents_tenant on incidents(tenant_id, last_seen desc);
create index if not exists idx_incidents_cluster on incidents(tenant_id, cluster_key);

-- ── Findings extension (Stage 6/7 metadata) ──────────────────────────
alter table findings add column if not exists ai_filter_status   text;     -- 'kept' | 'dropped' | 'review'
alter table findings add column if not exists ai_summary         text;     -- one-line readable summary
alter table findings add column if not exists incident_id        uuid references incidents(id) on delete set null;
alter table findings add column if not exists final_risk_score   numeric(4,2);  -- 0..100, combines severity + confidence + AI signal
create index if not exists idx_findings_incident on findings(incident_id);

-- ── Assets extension ─────────────────────────────────────────────────
alter table aegis_assets add column if not exists enriched_metadata jsonb default '{}'::jsonb;
alter table aegis_assets add column if not exists discovered_by      text;     -- 'customer' | 'ai_enricher'
alter table aegis_assets add column if not exists enrichment_run_id  uuid references enrichment_runs(id) on delete set null;
update aegis_assets set discovered_by = 'customer' where discovered_by is null;

-- ── Realtime publications for the new live tables ─────────────────────
do $$
begin
  alter publication supabase_realtime add table enrichment_runs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table planner_runs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table composite_scan_arms;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table incidents;
exception when duplicate_object then null;
end $$;
