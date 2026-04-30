-- Phase 1 Step 20 — Risk scoring engine + alert routing.
--
-- Per Build Spec Part 8 risk → action routing table:
--   ≥80 CRITICAL: Slack #soc-critical • Email security+compliance+legal •
--      Auto-takedown sub-WF • SIEM webhook • PagerDuty • Compliance if PII
--   60-79 HIGH: Slack #soc-high • Analyst review queue • SIEM webhook
--   30-59 MEDIUM: Daily digest • Weekly review queue
--   <30 LOW: Log only • Trend analysis weekly

-- Reuse existing alerts table from Part 11; add fields needed for routing
alter table alerts add column if not exists rule_matched text;
alter table alerts add column if not exists priority    text check (priority in ('p0','p1','p2','p3','p4'));
alter table alerts add column if not exists status      text default 'pending'
  check (status in ('pending','sent','failed','acknowledged','suppressed'));

-- Routing rules (config-driven, can be edited from /admin/alerts)
create table if not exists alert_routing_rules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,
  rule_name       text not null,
  enabled         boolean default true,
  -- Match conditions (any AND-combined that are non-null)
  min_severity    text,                          -- 'Critical' | 'Substantial' | 'Moderate' | 'Low'
  min_risk_score  numeric,                       -- 0..100
  fraud_patterns  text[],                        -- if non-null, fraud_pattern must be one of
  recommended_actions text[],                    -- e.g. {takedown, compliance_escalation}
  -- Channel + delivery
  channels        text[] not null,               -- {slack, email, siem, pagerduty}
  channel_config  jsonb default '{}'::jsonb,    -- e.g. {slack_channel:"#soc-critical", email_to:["legal@..."]}
  priority        text default 'p2',
  created_at      timestamptz default now()
);
create index if not exists idx_alert_rules_tenant on alert_routing_rules(tenant_id, enabled);

-- Auto-takedown drafts (Phase 1 plan: drafts admin approves)
create table if not exists takedown_drafts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete cascade,
  finding_id      uuid references findings(id) on delete cascade,
  status          text default 'draft' check (status in ('draft','approved','rejected','submitted','succeeded','failed')),
  provider        text,                           -- 'google_play' | 'app_store' | 'cloudflare' | 'cert-in' | 'registrar'
  abuse_url       text,
  template_used   text,
  draft_body      text,
  decided_by      text,
  decided_at      timestamptz,
  submitted_at    timestamptz,
  external_ref    text,
  created_at      timestamptz default now()
);
create index if not exists idx_takedown_finding on takedown_drafts(finding_id);
create index if not exists idx_takedown_status on takedown_drafts(tenant_id, status);

-- Realtime publications
do $$ begin alter publication supabase_realtime add table alert_routing_rules; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table takedown_drafts;     exception when duplicate_object then null; end $$;

-- RLS
alter table alert_routing_rules enable row level security;
alter table takedown_drafts     enable row level security;
do $$ begin
  create policy alert_rules_admin_all on alert_routing_rules for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy takedown_drafts_admin_all on takedown_drafts for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy alert_rules_tenant_read on alert_routing_rules for select using (tenant_id = auth_tenant_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy takedown_drafts_tenant_read on takedown_drafts for select
    using (finding_id in (select id from findings where tenant_id = auth_tenant_id()));
exception when duplicate_object then null; end $$;

-- Default routing rules for CA Grameen (per Build Spec Part 8)
insert into alert_routing_rules (tenant_id, rule_name, min_severity, channels, channel_config, priority)
values
  ('23610954-5fd0-482f-8eb0-11edce1f5c58', 'critical_findings', 'Critical',
    ARRAY['slack','email','siem']::text[],
    '{"slack_channel":"#soc-critical","email_to":["security@creditaccessgrameen.in","compliance@creditaccessgrameen.in"]}'::jsonb,
    'p1'),
  ('23610954-5fd0-482f-8eb0-11edce1f5c58', 'high_findings', 'Substantial',
    ARRAY['slack']::text[],
    '{"slack_channel":"#soc-high"}'::jsonb,
    'p2'),
  ('23610954-5fd0-482f-8eb0-11edce1f5c58', 'compliance_escalation', NULL,
    ARRAY['email','pagerduty']::text[],
    '{"email_to":["legal@creditaccessgrameen.in","compliance@creditaccessgrameen.in"]}'::jsonb,
    'p1')
on conflict do nothing;
update alert_routing_rules set recommended_actions = ARRAY['compliance_escalation']::text[]
  where rule_name = 'compliance_escalation' AND recommended_actions IS NULL;
