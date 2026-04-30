-- Phase 1 Step 2 — Schema reconcile against build spec Part 11.
--
-- Strategy: keep existing tables (tenants, aegis_assets, etc.) — they're
-- semantically equivalent to the spec's customers/customer_assets and the
-- platform already references them everywhere. Only add what's genuinely
-- missing.

-- ── Genuinely missing: scan_schedules ────────────────────────────────────
-- Part 11 calls for per-(customer × feature) schedule rows so admin can
-- enable/disable per feature without touching Apify directly.
create table if not exists scan_schedules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  feature_id      text not null,                          -- 'FEAT-001' .. 'FEAT-034'
  cadence         text not null check (cadence in (
    'manual', 'hourly', 'every_4h', 'every_6h', 'every_12h', 'daily', 'weekly'
  )),
  enabled         boolean not null default false,         -- DEFAULT FALSE — Starter cost discipline
  apify_schedule_id text,                                 -- null until enabled
  next_run_at     timestamptz,
  last_run_at     timestamptz,
  last_run_status text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (tenant_id, feature_id)
);
create index if not exists idx_scan_schedules_tenant on scan_schedules(tenant_id);
create index if not exists idx_scan_schedules_enabled on scan_schedules(enabled) where enabled = true;

-- ── Findings extension: align with spec normalized output ────────────────
-- Spec Part 8 specifies a few fields not yet on findings.
alter table findings add column if not exists module           text;            -- 'A' .. 'N' per Part 5
alter table findings add column if not exists author           text;
alter table findings add column if not exists media_urls       text[];
alter table findings add column if not exists timestamp_collected timestamptz default now();
alter table findings add column if not exists risk_score       int default 0;
alter table findings add column if not exists risk_signals     text[];
alter table findings add column if not exists status           text default 'active'
  check (status in ('active','auto_suppressed','analyst_dismissed','resolved'));

-- Composite unique key per spec: (customer_id, source, item_id, scan_run_id)
-- Current key is (apify_task_id, item_id) which is partial (no Kali rows). Add
-- a broader uniqueness constraint that allows null components but still
-- prevents true duplicates.
do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'ux_findings_dedupe') then
    create unique index ux_findings_dedupe on findings(tenant_id, source, item_id, scan_run_id)
      where item_id is not null;
  end if;
end $$;

-- ── Cost-circuit-breaker support: monthly_spend view + day_spend view ────
-- Materialized as views, no separate table. Used by /api/admin/scan/* routes
-- to refuse runs that would exceed Starter ($29/mo) cap.
create or replace view apify_spend_today as
select tenant_id, sum(coalesce(cost_usd, 0))::numeric(10,4) as today_spend
from apify_runs
where started_at >= date_trunc('day', now() at time zone 'UTC')
group by tenant_id;

create or replace view apify_spend_month as
select tenant_id, sum(coalesce(cost_usd, 0))::numeric(10,4) as month_spend,
  count(*) as run_count
from apify_runs
where started_at >= date_trunc('month', now() at time zone 'UTC')
group by tenant_id;

-- ── Realtime publications ────────────────────────────────────────────────
do $$
begin alter publication supabase_realtime add table scan_schedules;
exception when duplicate_object then null; end $$;

-- ── RLS for new table ────────────────────────────────────────────────────
alter table scan_schedules enable row level security;
do $$ begin
  create policy scan_schedules_tenant_read on scan_schedules
    for select using (is_admin() or tenant_id = auth_tenant_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy scan_schedules_admin_write on scan_schedules
    for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

-- ── Bootstrap default schedules for the CA Grameen tenant ────────────────
-- All schedules default to disabled — admin enables in /admin/apify per
-- Phase 1 plan ($29/mo cap, manual mode default).
insert into scan_schedules (tenant_id, feature_id, cadence, enabled)
select '23610954-5fd0-482f-8eb0-11edce1f5c58'::uuid, fid, cadence, false
from (values
  ('FEAT-001', 'daily'),       ('FEAT-002', 'weekly'),
  ('FEAT-003', 'manual'),      ('FEAT-004', 'manual'),
  ('FEAT-005', 'daily'),       ('FEAT-006', 'manual'),
  ('FEAT-007', 'every_12h'),   ('FEAT-019', 'daily'),
  ('FEAT-020', 'daily'),       ('FEAT-022', 'daily'),
  ('FEAT-023', 'daily')
) as p(fid, cadence)
on conflict (tenant_id, feature_id) do nothing;
