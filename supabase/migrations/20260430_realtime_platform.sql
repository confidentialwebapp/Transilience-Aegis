-- Real-time DRP platform schema.
-- Tracks: tenants, their subscribed services, asset registry, scan runs,
-- findings, DLR (HIBP-derived) records, Apify cost ledger, audit log.
-- RLS policies live in a separate migration (Track F).

create extension if not exists "pgcrypto";

-- ── Tenants ────────────────────────────────────────────────────────────
create table if not exists tenants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  primary_brand  text,
  primary_domain text,
  status         text default 'active' check (status in ('active','suspended','demo')),
  created_at     timestamptz default now()
);

-- ── Subscription gate — one row per (tenant, service) ──────────────────
create table if not exists tenant_services (
  tenant_id   uuid references tenants(id) on delete cascade,
  service     text check (service in (
    'brand_monitoring','social_media_monitoring','mobile_app_monitoring',
    'domain_monitoring','dark_web_monitoring','messaging_suite',
    'url_scan_suite','dns_suite','intellicode_copyid','weblogic_saas',
    'wss','incident_response','accessibility'
  )),
  active      boolean default true,
  limit_value int,
  starts_at   timestamptz default now(),
  ends_at     timestamptz,
  primary key (tenant_id, service)
);

-- ── Canonical assets (post-admin approval) ─────────────────────────────
create table if not exists assets (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id) on delete cascade,
  type       text not null check (type in (
    'domain','subdomain','brand_name','social_handle','mobile_app',
    'executive_email','executive_handle','keyword','bin'
  )),
  value      text not null,
  metadata   jsonb default '{}'::jsonb,
  active     boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_assets_tenant on assets(tenant_id, active);

-- ── Customer-submitted assets awaiting admin approval ──────────────────
create table if not exists asset_submissions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id) on delete cascade,
  submitted_by uuid,
  type         text not null,
  value        text not null,
  notes        text,
  status       text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);
create index if not exists idx_asset_submissions_status on asset_submissions(status, created_at desc);

-- ── Scan runs (each n8n workflow execution) ────────────────────────────
create table if not exists scan_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  brand         text,
  service       text not null,
  trigger       text,
  triggered_by  uuid,
  n8n_run_id    text,
  status        text default 'queued' check (status in ('queued','running','completed','failed')),
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  finding_count int default 0,
  payload       jsonb default '{}'::jsonb
);
create index if not exists idx_scan_runs_tenant on scan_runs(tenant_id, started_at desc);
create index if not exists idx_scan_runs_status on scan_runs(status, started_at desc);

-- ── Unified findings (every engine writes here) ────────────────────────
create table if not exists findings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references tenants(id) on delete cascade,
  asset_id            uuid references assets(id) on delete set null,
  scan_run_id         uuid references scan_runs(id) on delete cascade,
  source              text,
  kind                text,
  severity            text check (severity in ('Critical','Substantial','Moderate','Low')),
  confidence          numeric(3,2),
  url_or_value        text,
  evidence            jsonb default '{}'::jsonb,
  ai_filtered         boolean default false,
  ai_reason           text,
  recommended_action  text,
  created_at          timestamptz default now()
);
create index if not exists idx_findings_tenant_created on findings(tenant_id, created_at desc);
create index if not exists idx_findings_scan_run on findings(scan_run_id);
create index if not exists idx_findings_severity on findings(tenant_id, severity, created_at desc);

-- ── DLR records (HIBP-derived, separate for the existing UI shape) ─────
create table if not exists dlr_records (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references tenants(id) on delete cascade,
  scan_run_id    uuid references scan_runs(id) on delete cascade,
  breach_name    text not null,
  data_classes   text[],
  affected_email text,
  status         text default 'RECOVERED' check (status in ('RECOVERED','WAITING','OPEN','RECOVERY_FAILED')),
  source         text default 'hibp',
  added_at       timestamptz default now()
);
create index if not exists idx_dlr_tenant_added on dlr_records(tenant_id, added_at desc);
create index if not exists idx_dlr_scan_run on dlr_records(scan_run_id);

-- ── Apify cost / debug ledger ──────────────────────────────────────────
create table if not exists apify_runs (
  run_id      text primary key,
  tenant_id   uuid references tenants(id) on delete cascade,
  service     text,
  actor_id    text,
  started_at  timestamptz default now(),
  finished_at timestamptz,
  items       int,
  cost_usd    numeric(10,4),
  status      text
);
create index if not exists idx_apify_runs_tenant on apify_runs(tenant_id, started_at desc);

-- ── Admin action audit log ─────────────────────────────────────────────
create table if not exists audit_log (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid,
  action    text not null,
  target    text,
  payload   jsonb default '{}'::jsonb,
  at        timestamptz default now()
);
create index if not exists idx_audit_at on audit_log(at desc);
create index if not exists idx_audit_actor on audit_log(actor_id, at desc);

-- ── Admin allowlist ────────────────────────────────────────────────────
create table if not exists admin_users (
  user_id   uuid primary key,
  email     text unique not null,
  role      text default 'admin' check (role in ('admin','soc','readonly')),
  added_at  timestamptz default now()
);

-- Seed: admin email (user_id is a placeholder uuid; real id linked when they sign in)
insert into admin_users (user_id, email, role)
values ('00000000-0000-0000-0000-000000000001', 'fde@transilienceai.com', 'admin')
on conflict (email) do nothing;

-- ── Demo tenant: CreditAccess Grameen ──────────────────────────────────
do $$
declare
  v_tenant_id uuid;
begin
  insert into tenants (name, primary_brand, primary_domain, status)
  values ('CreditAccess Grameen', 'CreditAccess Grameen', 'creditaccessgrameen.in', 'demo')
  returning id into v_tenant_id;

  -- All 13 services active
  insert into tenant_services (tenant_id, service, active, limit_value)
  values
    (v_tenant_id, 'brand_monitoring',         true, null),
    (v_tenant_id, 'social_media_monitoring',  true, null),
    (v_tenant_id, 'mobile_app_monitoring',    true, null),
    (v_tenant_id, 'domain_monitoring',        true, null),
    (v_tenant_id, 'dark_web_monitoring',      true, null),
    (v_tenant_id, 'messaging_suite',          true, null),
    (v_tenant_id, 'url_scan_suite',           true, null),
    (v_tenant_id, 'dns_suite',                true, null),
    (v_tenant_id, 'intellicode_copyid',       true, null),
    (v_tenant_id, 'weblogic_saas',            true, null),
    (v_tenant_id, 'wss',                      true, 1),
    (v_tenant_id, 'incident_response',        true, null),
    (v_tenant_id, 'accessibility',            true, null);

  -- Seed assets
  insert into assets (tenant_id, type, value, metadata) values
    (v_tenant_id, 'domain',         'creditaccessgrameen.in',   '{"primary": true}'::jsonb),
    (v_tenant_id, 'brand_name',     'CreditAccess Grameen',     '{}'::jsonb),
    (v_tenant_id, 'social_handle',  'creditaccessgrameen',      '{"platform_hint":"any"}'::jsonb),
    (v_tenant_id, 'keyword',        'creditaccess-grameen.in',  '{"reason":"typosquat"}'::jsonb),
    (v_tenant_id, 'keyword',        'creditaccessgramen.in',    '{"reason":"typosquat"}'::jsonb),
    (v_tenant_id, 'keyword',        'creditaccessgrameen.com',  '{"reason":"typosquat"}'::jsonb);
end $$;

-- ── Realtime publication ───────────────────────────────────────────────
-- Customer portal subscribes to changes on these tables for live updates.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table findings;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table scan_runs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table dlr_records;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
