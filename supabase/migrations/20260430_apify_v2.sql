-- Apify v2 expansion: per-feature findings, Apify Task ledger, Apify run cost tracking.
-- Backfills existing findings rows with feature_id='FEAT-007' (the brand-monitoring
-- workflow we already shipped used google-search-scraper which maps to FEAT-007).

create extension if not exists "pgcrypto";

-- ── Apify Tasks config ────────────────────────────────────────────────
create table if not exists apify_tasks (
  task_id          text primary key,                     -- 'tai-aegis/creditaccessgrameen-feat-001-en'
  tenant_id        uuid references tenants(id) on delete cascade,
  feature_id       text not null,                        -- 'FEAT-001'
  feature_label    text,                                 -- 'Google Play Rogue App Detection'
  language         text,                                 -- 'en' / 'hi' / 'kn' / etc.
  actor_id         text not null,                        -- 'lukaskrivka/google-play-store-scraper'
  schedule_cron    text,                                 -- '0 */6 * * *'
  apify_schedule_id text,                                -- populated after Apify-side provisioning
  proxy_group      text default 'RESIDENTIAL',
  proxy_country    text default 'IN',
  active           boolean default true,
  config           jsonb default '{}'::jsonb,            -- raw actor input minus the rotating keyword
  created_at       timestamptz default now()
);
create index if not exists idx_apify_tasks_tenant on apify_tasks(tenant_id);
create index if not exists idx_apify_tasks_feature on apify_tasks(feature_id);

-- ── Extend findings table with v2 spec fields ─────────────────────────
alter table findings add column if not exists feature_id            text;
alter table findings add column if not exists apify_task_id         text references apify_tasks(task_id) on delete set null;
alter table findings add column if not exists apify_run_id          text;
alter table findings add column if not exists apify_dataset_id      text;
alter table findings add column if not exists item_id               text;
alter table findings add column if not exists language_detected     text;
alter table findings add column if not exists fraud_pattern         text;          -- fake_app | phishing | recovery_scam | job_scam | impersonation | leak | fake_branch
alter table findings add column if not exists engagement            jsonb;
alter table findings add column if not exists matched_keywords      text[];
alter table findings add column if not exists timestamp_source      timestamptz;
alter table findings add column if not exists needs_review          boolean default false;
alter table findings add column if not exists alert_sent            boolean default false;

-- Backfill: tag the existing brand-monitoring rows
update findings set feature_id = 'FEAT-007' where feature_id is null and source = 'apify:google-search';
update findings set fraud_pattern = case kind
  when 'phishing' then 'phishing'
  when 'fraud' then 'recovery_scam'
  when 'username_squat' then 'impersonation'
  when 'brand_impersonation' then 'impersonation'
  when 'domain_typosquat' then 'phishing'
  when 'leaked_asset' then 'leak'
  else null end
where fraud_pattern is null;

-- Indexes for the new feature_id-scoped pages
create index if not exists idx_findings_tenant_feature on findings(tenant_id, feature_id, created_at desc);
create index if not exists idx_findings_apify_run on findings(apify_run_id);
create unique index if not exists ux_findings_apify_dedup on findings(apify_task_id, item_id) where apify_task_id is not null and item_id is not null;

-- ── Extend apify_runs (cost tracking) — add fields if missing ────────
alter table apify_runs add column if not exists feature_id     text;
alter table apify_runs add column if not exists task_id        text references apify_tasks(task_id) on delete set null;
alter table apify_runs add column if not exists trigger        text;     -- 'schedule' | 'admin_manual' | 'webhook_chain'
alter table apify_runs add column if not exists dataset_id     text;
alter table apify_runs add column if not exists compute_units  numeric(10,4);
alter table apify_runs add column if not exists error_message  text;
create index if not exists idx_apify_runs_tenant_feature on apify_runs(tenant_id, feature_id, started_at desc);

-- ── Extend scan_runs to know which feature ───────────────────────────
alter table scan_runs add column if not exists feature_id      text;
alter table scan_runs add column if not exists apify_run_id    text;
alter table scan_runs add column if not exists apify_task_id   text;
update scan_runs set feature_id = 'FEAT-007' where feature_id is null and service = 'brand_monitoring';
create index if not exists idx_scan_runs_feature on scan_runs(feature_id, started_at desc);

-- ── Realtime publications for the new tables ─────────────────────────
do $$
begin
  alter publication supabase_realtime add table apify_tasks;
exception when duplicate_object then null;
end $$;

-- ── Seed CA Grameen Apify Tasks (placeholder rows — no Apify-side provisioning yet) ──
do $$
declare
  t_id uuid;
begin
  select id into t_id from tenants where primary_domain = 'creditaccessgrameen.in' limit 1;
  if t_id is not null then
    insert into apify_tasks(task_id, tenant_id, feature_id, feature_label, language, actor_id, schedule_cron, proxy_group, proxy_country)
    values
      ('tai-aegis/creditaccessgrameen-feat-001-en', t_id, 'FEAT-001', 'Google Play Rogue App Detection', 'en', 'lukaskrivka/google-play-store-scraper', '0 */6 * * *', 'RESIDENTIAL', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-001-hi', t_id, 'FEAT-001', 'Google Play Rogue App Detection', 'hi', 'lukaskrivka/google-play-store-scraper', '0 */6 * * *', 'RESIDENTIAL', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-001-kn', t_id, 'FEAT-001', 'Google Play Rogue App Detection', 'kn', 'lukaskrivka/google-play-store-scraper', '0 */6 * * *', 'RESIDENTIAL', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-007-tier1-en', t_id, 'FEAT-007', 'Brand Mention SERP Tier1', 'en', 'apify/google-search-scraper', '0 * * * *', 'GOOGLE_SERP', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-007-tier3-hi', t_id, 'FEAT-007', 'Brand Mention SERP Tier3', 'hi', 'apify/google-search-scraper', '0 4 * * *', 'GOOGLE_SERP', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-019-whois', t_id, 'FEAT-019', 'Domain WHOIS/DNS/SSL', 'en', 'sovereigntaylor/domain-whois-scraper', '0 2 * * *', 'DATACENTER', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-022-defacement', t_id, 'FEAT-022', 'Defacement Detection', 'en', 'apify/web-scraper', '0 * * * *', 'DATACENTER', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-024-naukri', t_id, 'FEAT-024', 'Recruitment Scam Detection', 'en', 'agentx/all-jobs-scraper', '0 6 * * *', 'RESIDENTIAL', 'IN'),
      ('tai-aegis/creditaccessgrameen-feat-026-fake-branches', t_id, 'FEAT-026', 'Google Maps Fake Branch Detection', 'en', 'compass/crawler-google-places', '0 6 * * 1', 'RESIDENTIAL', 'IN')
    on conflict (task_id) do nothing;
  end if;
end $$;
